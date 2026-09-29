'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable, TD } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';
import { useAsyncData, useDebouncedValue } from '@/lib/useAsync';
import { formatDateTime, formatNumber, toFiniteNumber } from '@/lib/format';

const FETCH_LIMIT = 200;
const PAGE_SIZE = 50;

type HistoryItem = {
  publicId: string;
  result: string;
  method: string;
  riskLevel?: string;
  createdAt: string;
  serial?: string;
};

function rangeError(range: DateRangeValue): string {
  if (!range.from || !range.to) return 'Select both a start and an end date.';
  if (Number.isNaN(Date.parse(range.from)) || Number.isNaN(Date.parse(range.to))) {
    return 'Enter valid dates.';
  }
  if (range.from > range.to) return 'Start date must be on or before the end date.';
  return '';
}

export default function VerificationHistoryPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);
  const invalidRange = rangeError(range);

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const res = await api.getVerificationHistory(tenantId, { limit: FETCH_LIMIT, range });
      return {
        items: (Array.isArray(res?.items) ? res.items : []) as HistoryItem[],
        total: toFiniteNumber(res?.total),
      };
    },
    [tenantId, range.from, range.to],
    { enabled: !!tenantId && !invalidRange },
  );

  const allItems = data?.items ?? [];
  const total = data?.total ?? 0;

  const resultOptions = useMemo(
    () => Array.from(new Set(allItems.map((e) => e.result).filter(Boolean))).sort(),
    [allItems],
  );

  const filtered = useMemo(
    () =>
      allItems.filter((e) => {
        if (resultFilter && e.result !== resultFilter) return false;
        if (!debouncedSearch) return true;
        return [e.serial, e.publicId, e.method, e.riskLevel]
          .some((v) => typeof v === 'string' && v.toLowerCase().includes(debouncedSearch));
      }),
    [allItems, resultFilter, debouncedSearch],
  );

  useEffect(() => {
    setPage(0);
  }, [tenantId, range.from, range.to, resultFilter, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const hasNext = pageItems.length === PAGE_SIZE && (safePage + 1) * PAGE_SIZE < filtered.length;

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  return (
    <>
      <PageHeader
        title="Verification History"
        subtitle={`${formatNumber(total)} events · ${invalidRange ? '—' : formatRangeLabel(range)}`}
        action={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="mb-4 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Input
          label="Search"
          placeholder="Serial, public ID, method or risk"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select label="Result" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">All results</option>
          {resultOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </div>

      {invalidRange && <Alert variant="warning">{invalidRange}</Alert>}

      {error && !invalidRange && (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {total > allItems.length && !invalidRange && (
        <Alert variant="info">
          Showing the most recent {formatNumber(allItems.length)} of {formatNumber(total)} events.
          Narrow the date range to see older events.
        </Alert>
      )}

      {loading && !data ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={['Time', 'Result', 'Method', 'Serial', 'Risk']}
            rows={invalidRange ? [] : pageItems}
            rowKey={(e, i) => e.publicId || `row-${i}`}
            emptyMessage={
              debouncedSearch || resultFilter
                ? 'No verification events match your filters.'
                : 'No verification events in this date range.'
            }
            renderRow={(e) => (
              <>
                <TD>{formatDateTime(e.createdAt)}</TD>
                <TD>{e.result || '—'}</TD>
                <TD>{e.method || '—'}</TD>
                <TD>{e.serial ?? '—'}</TD>
                <TD>{e.riskLevel ?? '—'}</TD>
              </>
            )}
          />
          {!invalidRange && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-hope-secondary">
              <span>
                Showing {formatNumber(safePage * PAGE_SIZE + 1)}–
                {formatNumber(safePage * PAGE_SIZE + pageItems.length)} of {formatNumber(filtered.length)}
                {loading ? ' · Loading…' : ''}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage === 0}
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasNext}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
