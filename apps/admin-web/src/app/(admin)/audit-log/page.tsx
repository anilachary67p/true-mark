'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable, TD } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { api } from '@/lib/api';
import { DateRangeValue } from '@/lib/dateRange';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { useAsyncData, useDebouncedValue } from '@/lib/useAsync';
import { formatDateTime, formatNumber, toFiniteNumber } from '@/lib/format';

const PAGE_SIZE = 50;
const FILTER_MAX = 100;

type AuditItem = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  createdAt: string;
  user?: { email: string; name?: string };
};

export default function AuditLogPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));

  const debouncedAction = useDebouncedValue(actionFilter.trim(), 350);
  const debouncedResource = useDebouncedValue(resourceFilter.trim(), 350);
  const filterError =
    debouncedAction.length > FILTER_MAX || debouncedResource.length > FILTER_MAX
      ? `Filters must be at most ${FILTER_MAX} characters.`
      : '';

  useEffect(() => {
    setOffset(0);
  }, [debouncedAction, debouncedResource, tenantId, range.from, range.to]);

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const res = await api.getAuditLogs(tenantId, {
        limit: PAGE_SIZE,
        offset,
        action: debouncedAction || undefined,
        resourceType: debouncedResource || undefined,
        range,
      });
      return {
        items: (Array.isArray(res?.items) ? res.items : []) as AuditItem[],
        total: toFiniteNumber(res?.total),
      };
    },
    [tenantId, offset, debouncedAction, debouncedResource, range.from, range.to],
    { enabled: !!tenantId && !filterError },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = items.length >= PAGE_SIZE && offset + items.length < total;

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle={`Immutable record of admin actions (${formatNumber(total)} total)`}
        action={<DateRangePicker value={range} onChange={setRange} />}
      />
      <div className="mb-4 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Input
          label="Filter by action"
          placeholder="e.g. QR_STATUS_CHANGED"
          value={actionFilter}
          maxLength={FILTER_MAX}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <Input
          label="Filter by resource type"
          placeholder="e.g. QrCode"
          value={resourceFilter}
          maxLength={FILTER_MAX}
          onChange={(e) => setResourceFilter(e.target.value)}
        />
      </div>

      {filterError && <Alert variant="warning">{filterError}</Alert>}

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
          <DataTable
            columns={['Time', 'Action', 'Resource', 'User']}
            rows={items}
            rowKey={(row) => row.id}
            emptyMessage={
              debouncedAction || debouncedResource
                ? 'No audit entries match your filter.'
                : 'No audit entries recorded yet.'
            }
            renderRow={(row) => (
              <>
                <TD>{formatDateTime(row.createdAt)}</TD>
                <TD>{row.action || '—'}</TD>
                <TD>
                  {row.resourceType || '—'}
                  {row.resourceId ? ` · ${String(row.resourceId).slice(0, 8)}…` : ''}
                </TD>
                <TD>{row.user?.email ?? '—'}</TD>
              </>
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-hope-secondary">
            <span>
              {items.length > 0
                ? `Showing ${formatNumber(offset + 1)}–${formatNumber(offset + items.length)} of ${formatNumber(total)}`
                : ''}
              {loading && data ? ' · Loading…' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!hasPrev || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasNext || loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
