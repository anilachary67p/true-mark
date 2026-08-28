'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function AuditLogPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<
    Array<{
      id: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      createdAt: string;
      user?: { email: string; name?: string };
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (!tenantId) return;
    api
      .getAuditLogs(tenantId, { limit: 100, action: actionFilter || undefined })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      });
  }, [router, tenantId, actionFilter]);

  return (
    <AdminShell>
      <h1>Audit Log</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>
        Immutable record of admin actions ({total} total).
      </p>
      <input
        placeholder="Filter by action (e.g. QR_STATUS_CHANGED)"
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        style={{ width: '100%', maxWidth: 420, marginBottom: '1rem', padding: 8 }}
      />
      <table style={{ width: '100%', background: '#fff', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Resource</th>
            <th style={{ textAlign: 'left', padding: 8 }}>User</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td style={{ padding: 8, fontSize: 13 }}>{new Date(row.createdAt).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{row.action}</td>
              <td style={{ padding: 8, fontSize: 13 }}>
                {row.resourceType}
                {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ''}
              </td>
              <td style={{ padding: 8, fontSize: 13 }}>{row.user?.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}
