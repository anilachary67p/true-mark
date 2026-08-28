'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function InvestigationsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<
    Array<{ id: string; title: string; status: string; description?: string }>
  >([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = (tid: string) => api.getInvestigations(tid).then(setItems);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId]);

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader title="Investigations" subtitle="Track and manage fraud investigations" />

      <PageCard title="Open new investigation">
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <Button
            className="self-start"
            onClick={async () => {
              await api.createInvestigation(tenantId, { title, description });
              setTitle('');
              setDescription('');
              load(tenantId);
            }}
          >
            Open investigation
          </Button>
        </div>
      </PageCard>

      {items.map((inv) => (
        <PageCard key={inv.id}>
          <div className="mb-2 flex items-center gap-2">
            <p className="font-semibold text-hope-dark">{inv.title}</p>
            <StatusChip status={inv.status} />
          </div>
          {inv.description && (
            <p className="mb-4 text-sm text-hope-secondary">{inv.description}</p>
          )}
          {inv.status === 'OPEN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await api.updateInvestigationStatus(tenantId, inv.id, 'UNDER_REVIEW', 'Review started');
                load(tenantId);
              }}
            >
              Mark under review
            </Button>
          )}
        </PageCard>
      ))}
    </>
  );
}
