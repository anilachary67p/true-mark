'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/Input';
import { TR, TD } from '@/components/ui/Table';
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

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader title="Audit Log" subtitle={`Immutable record of admin actions (${total} total)`} />
      <div className="mb-4 max-w-md">
        <Input
          label="Filter by action"
          placeholder="e.g. QR_STATUS_CHANGED"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
      </div>
      <DataTable
        columns={['Time', 'Action', 'Resource', 'User']}
        isEmpty={items.length === 0}
        emptyMessage="No audit entries match your filter."
      >
        {items.map((row) => (
          <TR key={row.id}>
            <TD>{new Date(row.createdAt).toLocaleString()}</TD>
            <TD>{row.action}</TD>
            <TD>
              {row.resourceType}
              {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ''}
            </TD>
            <TD>{row.user?.email ?? '—'}</TD>
          </TR>
        ))}
      </DataTable>
    </>
  );
}
