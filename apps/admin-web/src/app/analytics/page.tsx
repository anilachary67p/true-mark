'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function AnalyticsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [daily, setDaily] = useState<Array<{ date: string; metrics: Record<string, unknown> }>>([]);
  const [message, setMessage] = useState('');

  const load = async (tid: string) => {
    setDashboard(await api.getDashboard(tid));
    setDaily(await api.getAnalyticsDaily(tid));
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId]);

  return (
    <AdminShell>
      <h1>Analytics</h1>
      <button
        style={{ marginBottom: '1rem' }}
        onClick={async () => {
          if (!tenantId) return;
          await api.triggerAnalyticsRollup(tenantId);
          setMessage('Daily rollup triggered');
          load(tenantId);
        }}
      >
        Run daily rollup
      </button>
      {message && <p style={{ color: '#0a7' }}>{message}</p>}

      {dashboard && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          {Object.entries(dashboard)
            .filter(([k]) => !['recentVerifications'].includes(k))
            .map(([k, v]) => (
              <div key={k} style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{String(v)}</div>
              </div>
            ))}
        </div>
      )}

      <h2>Daily rollups ({daily.length})</h2>
      <pre
        style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: 8,
          fontSize: 12,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(daily, null, 2)}
      </pre>
    </AdminShell>
  );
}
