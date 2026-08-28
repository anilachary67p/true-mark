'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { TR, TD } from '@/components/ui/Table';
import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';

export default function VerificationHistoryPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [items, setItems] = useState<
    Array<{
      publicId: string;
      result: string;
      method: string;
      riskLevel?: string;
      createdAt: string;
      serial?: string;
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (tid: string, nextRange: DateRangeValue) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getVerificationHistory(tid, { limit: 100, range: nextRange });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId, range);
  }, [router, tenantId, range, load]);

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader
        title="Verification History"
        subtitle={`${total} events · ${formatRangeLabel(range)}`}
        action={<DateRangePicker value={range} onChange={setRange} />}
      />
      <FeedbackAlert message={error} severity="error" />

      {loading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={['Time', 'Result', 'Method', 'Serial', 'Risk']}
          isEmpty={items.length === 0}
          emptyMessage="No verification events in this date range."
        >
          {items.map((e) => (
            <TR key={e.publicId}>
              <TD>{new Date(e.createdAt).toLocaleString()}</TD>
              <TD>{e.result}</TD>
              <TD>{e.method}</TD>
              <TD>{e.serial ?? '—'}</TD>
              <TD>{e.riskLevel ?? '—'}</TD>
            </TR>
          ))}
        </DataTable>
      )}
    </>
  );
}
