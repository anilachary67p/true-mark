'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    api.me().then(async (me) => {
      const tid = me.user.tenantIds[0];
      if (!tid) {
        const tenants = await api.getTenants();
        if (tenants[0]) {
          setTenantId(tenants[0].id);
          setData(await api.getDashboard(tenants[0].id));
        }
        return;
      }
      setTenantId(tid);
      setData(await api.getDashboard(tid));
    }).catch(() => router.push('/login'));
  }, [router]);

  if (!data) return <AdminShell><p>Loading...</p></AdminShell>;

  const cards = [
    { label: 'Total Verifications', value: data.totalVerifications },
    { label: 'Verified', value: data.verified },
    { label: 'Reverified', value: data.reverified },
    { label: 'Suspicious', value: data.suspicious },
    { label: 'Possible Clone', value: data.possibleClone },
    { label: 'Invalid QR', value: data.invalidQr },
  ];

  return (
    <AdminShell>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: '#fff', padding: '1.25rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 13, color: '#666' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{String(c.value ?? 0)}</div>
          </div>
        ))}
      </div>
      {tenantId && <p style={{ marginTop: '1rem', fontSize: 13, color: '#888' }}>Tenant: {tenantId}</p>}
    </AdminShell>
  );
}
