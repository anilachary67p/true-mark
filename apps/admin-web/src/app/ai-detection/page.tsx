'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function AiDetectionPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [config, setConfig] = useState<{ mode: string; quota: number; usage?: number } | null>(
    null,
  );
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

  if (!tenantId)
    return (
      <AdminShell>
        <h1>AI Detection</h1>
      </AdminShell>
    );

  return (
    <AdminShell>
      <h1>AI Detection</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Configure AI validation mode, quotas, and reference data.
      </p>
      {message && <p style={{ color: '#0a7' }}>{message}</p>}

      {config && (
        <section
          style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}
        >
          <h3>AI Mode</h3>
          <p>
            Current: <strong>{config.mode}</strong> · Quota: {config.usage ?? 0} / {config.quota}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {(['AI_DISABLED', 'AI_OPTIONAL', 'AI_REQUIRED'] as const).map((mode) => (
              <button
                key={mode}
                onClick={async () => {
                  await api.updateAiConfig(tenantId, { mode });
                  setMessage(`AI mode set to ${mode}`);
                  load(tenantId);
                }}
              >
                {mode.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
        <h3>Reference data</h3>
        <input
          placeholder="Object storage key (e.g. refs/product-front.jpg)"
          value={objectKey}
          onChange={(e) => setObjectKey(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button
          onClick={async () => {
            await api.createReferenceData(tenantId, { objectKey, scope: 'product' });
            setObjectKey('');
            setMessage('Reference data added');
            load(tenantId);
          }}
        >
          Add reference
        </button>
        <ul style={{ marginTop: 12 }}>
          {refs.map((r) => (
            <li
              key={r.id}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
            >
              <span>
                {r.scope}: {r.objectKey}
              </span>
              <button
                onClick={async () => {
                  await api.deleteReferenceData(tenantId, r.id);
                  load(tenantId);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
