'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function VerificationHistoryPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<
    Array<{
      publicId: string;
      result: string;
      method: string;
      riskLevel?: string;
      createdAt: string;
      serial?: string;
      productSnapshot?: Record<string, unknown>;
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (!tenantId) return;
    api
      .getVerificationHistory(tenantId)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'));
  }, [router, tenantId]);

  return (
    <AdminShell>
      <h1>Verification History</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>
        Tenant-scoped verification events ({total} total).
      </p>
      {error && <p style={{ color: '#b00020' }}>{error}</p>}
      <table
        style={{ width: '100%', background: '#fff', borderRadius: 8, borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Result</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Method</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Serial</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.publicId}>
              <td style={{ padding: 8, fontSize: 13 }}>{new Date(e.createdAt).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{e.result}</td>
              <td style={{ padding: 8 }}>{e.method}</td>
              <td style={{ padding: 8 }}>{e.serial ?? '—'}</td>
              <td style={{ padding: 8 }}>{e.riskLevel ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}
