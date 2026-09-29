'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const NOTE_MAX = 2000;

type Investigation = { id: string; title: string; status: string; description?: string };

type Transition = { status: string; label: string; confirm?: string; variant: 'outline' | 'danger' };

const TRANSITIONS: Record<string, Transition[]> = {
  OPEN: [
    { status: 'UNDER_REVIEW', label: 'Mark under review', variant: 'outline' },
    {
      status: 'FALSE_POSITIVE',
      label: 'Dismiss as false positive',
      variant: 'outline',
      confirm: 'Dismiss this investigation as a false positive? It will be closed.',
    },
  ],
  UNDER_REVIEW: [
    {
      status: 'RESOLVED',
      label: 'Resolve',
      variant: 'outline',
      confirm: 'Resolve and close this investigation?',
    },
    {
      status: 'FALSE_POSITIVE',
      label: 'Dismiss as false positive',
      variant: 'outline',
      confirm: 'Dismiss this investigation as a false positive? It will be closed.',
    },
    {
      status: 'CONFIRMED_COUNTERFEIT',
      label: 'Confirm counterfeit',
      variant: 'danger',
      confirm: 'Confirm this case as counterfeit? This is recorded in the audit log.',
    },
  ],
};

const DEFAULT_NOTES: Record<string, string> = {
  UNDER_REVIEW: 'Review started',
};

export default function InvestigationsPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState('');
  const [message, setMessage] = useState('');

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const res = await api.getInvestigations(tenantId);
      return (Array.isArray(res) ? res : []) as Investigation[];
    },
    [tenantId],
    { enabled: !!tenantId },
  );
  const items = data ?? [];

  const createAction = useAsyncAction((payload: { title: string; description?: string }) =>
    api.createInvestigation(tenantId, payload),
  );
  const statusAction = useAsyncAction((id: string, status: string, note?: string) =>
    api.updateInvestigationStatus(tenantId, id, status, note),
  );

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const titleError = !trimmedTitle
    ? 'Title is required.'
    : trimmedTitle.length > TITLE_MAX
      ? `Title must be at most ${TITLE_MAX} characters.`
      : '';
  const descriptionError =
    trimmedDescription.length > DESCRIPTION_MAX
      ? `Description must be at most ${DESCRIPTION_MAX} characters.`
      : '';
  const formInvalid = !!titleError || !!descriptionError;

  function clearFeedback() {
    setMessage('');
    createAction.clearError();
    statusAction.clearError();
  }

  async function createInvestigation() {
    setSubmitted(true);
    if (formInvalid) return;
    clearFeedback();
    const ok = await createAction.run({
      title: trimmedTitle,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    });
    if (ok) {
      setTitle('');
      setDescription('');
      setSubmitted(false);
      setMessage('Investigation opened');
      reload();
    }
  }

  async function changeStatus(inv: Investigation, transition: Transition) {
    const note = (notes[inv.id] ?? '').trim() || DEFAULT_NOTES[transition.status] || '';
    if (note.length > NOTE_MAX) return;
    if (transition.confirm && !window.confirm(transition.confirm)) return;
    clearFeedback();
    setUpdatingId(inv.id);
    const ok = await statusAction.run(inv.id, transition.status, note || undefined);
    setUpdatingId('');
    if (ok) {
      setNotes((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
      setMessage(`"${inv.title}" updated to ${transition.status.replace(/_/g, ' ').toLowerCase()}`);
      reload();
    }
  }

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  return (
    <>
      <PageHeader title="Investigations" subtitle="Track and manage fraud investigations" />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={createAction.error || statusAction.error} severity="error" />

      <PageCard title="Open new investigation">
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setSubmitted(true)}
              aria-invalid={(submitted || trimmedTitle.length > TITLE_MAX) && !!titleError}
            />
            {(submitted || trimmedTitle.length > TITLE_MAX) && titleError && (
              <p className="mt-1 text-xs text-hope-danger">{titleError}</p>
            )}
          </div>
          <div>
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              aria-invalid={!!descriptionError}
            />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-hope-danger">{descriptionError}</span>
              <span className="text-hope-muted">
                {trimmedDescription.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>
          <Button
            className="self-start"
            disabled={createAction.pending || formInvalid}
            onClick={createInvestigation}
          >
            {createAction.pending ? 'Opening…' : 'Open investigation'}
          </Button>
        </div>
      </PageCard>

      {error && (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {loading && !data ? (
        <PageSkeleton />
      ) : items.length === 0 ? (
        !error && (
          <PageCard>
            <EmptyState title="No investigations" description="Open an investigation to start tracking a case." />
          </PageCard>
        )
      ) : (
        items.map((inv) => {
          const transitions = TRANSITIONS[inv.status] ?? [];
          const note = notes[inv.id] ?? '';
          const noteError =
            note.trim().length > NOTE_MAX ? `Note must be at most ${NOTE_MAX} characters.` : '';
          const isUpdating = updatingId === inv.id;
          return (
            <PageCard key={inv.id}>
              <div className="mb-2 flex items-center gap-2">
                <p className="break-words font-semibold text-hope-dark">{inv.title || 'Untitled'}</p>
                <StatusChip status={inv.status} />
              </div>
              {inv.description && (
                <p className="mb-4 whitespace-pre-wrap break-words text-sm text-hope-secondary">
                  {inv.description}
                </p>
              )}
              {transitions.length > 0 && (
                <>
                  <div className="mb-3">
                    <Textarea
                      label="Status note (optional)"
                      rows={2}
                      value={note}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                      aria-invalid={!!noteError}
                    />
                    {noteError && <p className="mt-1 text-xs text-hope-danger">{noteError}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((t) => (
                      <Button
                        key={t.status}
                        size="sm"
                        variant={t.variant}
                        disabled={statusAction.pending || !!noteError}
                        onClick={() => changeStatus(inv, t)}
                      >
                        {isUpdating ? 'Updating…' : t.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </PageCard>
          );
        })
      )}
    </>
  );
}
