'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { Trash2 } from 'lucide-react';

export default function AiDetectionPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [config, setConfig] = useState<{ mode: string; quota: number; usage?: number } | null>(null);
  const [refs, setRefs] = useState<Array<{ id: string; scope: string; objectKey: string }>>([]);
  const [objectKey, setObjectKey] = useState('');
  const [message, setMessage] = useState('');

  const load = async (tid: string) => {
    setConfig(await api.getAiConfig(tid));
    setRefs(await api.listReferenceData(tid));
  };

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
      <PageHeader title="AI Detection" subtitle="Configure AI validation mode, quotas, and reference data" />
      <FeedbackAlert message={message} />

      {config && (
        <PageCard title="AI Mode">
          <p className="mb-3 text-sm text-hope-secondary">
            Current: <strong className="text-hope-dark">{config.mode}</strong> · Quota: {config.usage ?? 0} / {config.quota}
          </p>
          <div className="flex flex-wrap gap-2">
            {(['AI_DISABLED', 'AI_OPTIONAL', 'AI_REQUIRED'] as const).map((mode) => (
              <Button
                key={mode}
                variant={config.mode === mode ? 'primary' : 'outline'}
                size="sm"
                onClick={async () => {
                  await api.updateAiConfig(tenantId, { mode });
                  setMessage(`AI mode set to ${mode}`);
                  load(tenantId);
                }}
              >
                {mode.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </PageCard>
      )}

      <PageCard title="Reference data">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            label="Object storage key"
            placeholder="refs/product-front.jpg"
            value={objectKey}
            onChange={(e) => setObjectKey(e.target.value)}
            className="flex-1"
          />
          <Button
            className="shrink-0 self-end"
            onClick={async () => {
              await api.createReferenceData(tenantId, { objectKey, scope: 'product' });
              setObjectKey('');
              setMessage('Reference data added');
              load(tenantId);
            }}
          >
            Add reference
          </Button>
        </div>
        <ul className="divide-y divide-slate-100">
          {refs.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-hope-dark">{r.scope}: {r.objectKey}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="delete"
                onClick={async () => {
                  await api.deleteReferenceData(tenantId, r.id);
                  load(tenantId);
                }}
              >
                <Trash2 className="h-4 w-4 text-hope-danger" />
              </Button>
            </li>
          ))}
        </ul>
      </PageCard>
    </>
  );
}
