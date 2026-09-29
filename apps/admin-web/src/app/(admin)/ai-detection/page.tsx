'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { EmptyState } from '@/components/EmptyState';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { formatNumber, toFiniteNumber } from '@/lib/format';
import { parseIntInRange } from '@/lib/validation';
import { Trash2 } from 'lucide-react';

const AI_MODES = ['AI_DISABLED', 'AI_OPTIONAL', 'AI_REQUIRED'] as const;
type AiMode = (typeof AI_MODES)[number];
type ReferenceItem = { id: string; scope: string; objectKey: string };

const QUOTA_MAX = 10_000_000;
const OBJECT_KEY_MAX = 512;
const SAFE_OBJECT_KEY = /^[A-Za-z0-9/_.-]+$/;

function validateObjectKey(key: string, tenantId: string): string {
  if (!key) return 'Object key is required.';
  if (key.length > OBJECT_KEY_MAX) return `Object key must be at most ${OBJECT_KEY_MAX} characters.`;
  if (
    !SAFE_OBJECT_KEY.test(key) ||
    key.startsWith('/') ||
    key.split('/').some((s) => s === '' || s === '.' || s === '..')
  ) {
    return 'Use only letters, numbers, "/", "_", "." and "-" (no empty or relative path segments).';
  }
  if (!key.startsWith(`tenants/${tenantId}/`)) return `Key must start with tenants/${tenantId}/`;
  return '';
}

export default function AiDetectionPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [objectKey, setObjectKey] = useState('');
  const [objectKeyTouched, setObjectKeyTouched] = useState(false);
  const [quotaInput, setQuotaInput] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [config, refs] = await Promise.all([
        api.getAiConfig(tenantId),
        api.listReferenceData(tenantId),
      ]);
      return {
        config: config
          ? {
              mode: String(config.mode ?? ''),
              quota: toFiniteNumber(config.quota),
              usage: toFiniteNumber(config.usage),
            }
          : null,
        refs: (Array.isArray(refs) ? refs : []) as ReferenceItem[],
      };
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const config = data?.config ?? null;
  const refs = data?.refs ?? [];

  useEffect(() => {
    if (config) setQuotaInput(String(config.quota));
  }, [config?.quota]); // eslint-disable-line react-hooks/exhaustive-deps

  const modeAction = useAsyncAction((mode: AiMode) => api.updateAiConfig(tenantId, { mode }));
  const quotaAction = useAsyncAction((quota: number) => api.updateAiConfig(tenantId, { quota }));
  const addAction = useAsyncAction((key: string) =>
    api.createReferenceData(tenantId, { objectKey: key, scope: 'product' }),
  );
  const deleteAction = useAsyncAction((id: string) => api.deleteReferenceData(tenantId, id));

  const trimmedKey = objectKey.trim();
  const objectKeyError = tenantId ? validateObjectKey(trimmedKey, tenantId) : '';
  const parsedQuota = parseIntInRange(quotaInput, 0, QUOTA_MAX);
  const quotaError =
    parsedQuota === null ? `Quota must be a whole number between 0 and ${formatNumber(QUOTA_MAX)}.` : '';
  const actionError = modeAction.error || quotaAction.error || addAction.error || deleteAction.error;

  function clearFeedback() {
    setMessage('');
    modeAction.clearError();
    quotaAction.clearError();
    addAction.clearError();
    deleteAction.clearError();
  }

  async function changeMode(mode: AiMode) {
    if (!config || config.mode === mode) return;
    if (
      mode === 'AI_DISABLED' &&
      !window.confirm('Disable AI detection? Consumers will no longer be offered AI validation.')
    ) {
      return;
    }
    clearFeedback();
    if (await modeAction.run(mode)) {
      setMessage(`AI mode set to ${mode.replace(/_/g, ' ')}`);
      reload();
    }
  }

  async function saveQuota() {
    if (parsedQuota === null) return;
    clearFeedback();
    if (await quotaAction.run(parsedQuota)) {
      setMessage('AI quota updated');
      reload();
    }
  }

  async function addReference() {
    setObjectKeyTouched(true);
    if (objectKeyError) return;
    clearFeedback();
    if (await addAction.run(trimmedKey)) {
      setObjectKey('');
      setObjectKeyTouched(false);
      setMessage('Reference data added');
      reload();
    }
  }

  async function deleteReference(ref: ReferenceItem) {
    if (!window.confirm(`Delete reference "${ref.objectKey}"? This cannot be undone.`)) return;
    clearFeedback();
    setDeletingId(ref.id);
    const ok = await deleteAction.run(ref.id);
    setDeletingId('');
    if (ok) {
      setMessage('Reference data deleted');
      reload();
    }
  }

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  const busy = modeAction.pending || quotaAction.pending;

  return (
    <>
      <PageHeader title="AI Detection" subtitle="Configure AI validation mode, quotas, and reference data" />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={actionError} severity="error" />

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
      ) : (
        <>
          {config ? (
            <PageCard title="AI Mode">
              <p className="mb-3 text-sm text-hope-secondary">
                Current: <strong className="text-hope-dark">{config.mode || '—'}</strong> · Quota:{' '}
                {formatNumber(config.usage)} / {formatNumber(config.quota)}
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_MODES.map((mode) => (
                  <Button
                    key={mode}
                    variant={config.mode === mode ? 'primary' : 'outline'}
                    size="sm"
                    disabled={busy || config.mode === mode}
                    aria-pressed={config.mode === mode}
                    onClick={() => changeMode(mode)}
                  >
                    {mode.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <Input
                    label="Monthly quota"
                    type="number"
                    min={0}
                    max={QUOTA_MAX}
                    step={1}
                    value={quotaInput}
                    onChange={(e) => setQuotaInput(e.target.value)}
                    aria-invalid={!!quotaError}
                  />
                  {quotaError && <p className="mt-1 text-xs text-hope-danger">{quotaError}</p>}
                </div>
                <Button
                  className="shrink-0 self-start sm:mt-7"
                  disabled={busy || !!quotaError || parsedQuota === config.quota}
                  onClick={saveQuota}
                >
                  {quotaAction.pending ? 'Saving…' : 'Save quota'}
                </Button>
              </div>
            </PageCard>
          ) : (
            !error && (
              <PageCard title="AI Mode">
                <EmptyState title="AI configuration unavailable" description="No AI configuration exists for this tenant yet." />
              </PageCard>
            )
          )}

          <PageCard title="Reference data">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Input
                  label="Object storage key"
                  placeholder={`tenants/${tenantId}/refs/product-front.jpg`}
                  value={objectKey}
                  maxLength={OBJECT_KEY_MAX}
                  onChange={(e) => setObjectKey(e.target.value)}
                  onBlur={() => setObjectKeyTouched(true)}
                  aria-invalid={objectKeyTouched && !!objectKeyError}
                />
                {objectKeyTouched && objectKeyError && (
                  <p className="mt-1 text-xs text-hope-danger">{objectKeyError}</p>
                )}
              </div>
              <Button
                className="shrink-0 self-start sm:mt-7"
                disabled={addAction.pending || (objectKeyTouched && !!objectKeyError) || !trimmedKey}
                onClick={addReference}
              >
                {addAction.pending ? 'Adding…' : 'Add reference'}
              </Button>
            </div>
            {refs.length === 0 ? (
              <EmptyState title="No reference data" description="Add object keys for reference product images." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {refs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span className="break-all text-sm text-hope-dark">
                      {r.scope}: {r.objectKey}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${r.objectKey}`}
                      disabled={deleteAction.pending}
                      onClick={() => deleteReference(r)}
                    >
                      {deletingId === r.id ? (
                        <span className="text-xs">Deleting…</span>
                      ) : (
                        <Trash2 className="h-4 w-4 text-hope-danger" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>
        </>
      )}
    </>
  );
}
