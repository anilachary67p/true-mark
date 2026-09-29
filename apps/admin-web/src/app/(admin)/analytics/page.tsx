'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { MiniLineChart } from '@/components/ui/MiniLineChart';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';
import { formatDate, formatNumber, toFiniteNumber } from '@/lib/format';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { RefreshCw } from 'lucide-react';

type DailyRollup = { date: string; metrics: Record<string, unknown> };

function formatMetricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function AnalyticsPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [message, setMessage] = useState('');

  const analytics = useAsyncData(
    async () => {
      const [dash, rollups] = await Promise.all([
        api.getDashboard(tenantId, range),
        api.getAnalyticsDaily(tenantId, range),
      ]);
      return {
        dashboard: (dash ?? {}) as Record<string, unknown>,
        daily: (Array.isArray(rollups) ? rollups : []) as DailyRollup[],
      };
    },
    [tenantId, range.from, range.to],
    { enabled: !!tenantId },
  );

  const rollup = useAsyncAction(async () => {
    setMessage('');
    await api.triggerAnalyticsRollup(tenantId);
    setMessage('Daily rollup triggered');
    analytics.reload();
  });

  if (!tenantId) {
    return <PageSkeleton />;
  }

  const dashboard = analytics.data?.dashboard;
  const daily = analytics.data?.daily ?? [];

  const metrics = dashboard
    ? Object.entries(dashboard).filter(
        ([k, v]) =>
          !['recentVerifications', 'dailyVolume', 'dateRange'].includes(k) &&
          (typeof v === 'number' || (typeof v === 'string' && v !== '' && Number.isFinite(Number(v)))),
      )
    : [];

  const dailyVolume = Array.isArray(dashboard?.dailyVolume)
    ? (dashboard.dailyVolume as Array<{ count?: unknown }>).map((d) => toFiniteNumber(d?.count))
    : [];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Verification metrics for ${formatRangeLabel(range)}`}
        action={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="outline" onClick={() => void rollup.run()} disabled={rollup.pending}>
              <RefreshCw className={`h-4 w-4 ${rollup.pending ? 'animate-spin' : ''}`} />
              {rollup.pending ? 'Running…' : 'Run daily rollup'}
            </Button>
          </>
        }
      />
      <FeedbackAlert message={message} />
      {rollup.error && <Alert variant="error">{rollup.error}</Alert>}
      {analytics.error && (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{analytics.error}</span>
            <Button size="sm" variant="outline" onClick={analytics.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {analytics.loading && !dashboard ? (
        <PageSkeleton />
      ) : (
        dashboard && (
          <>
            <PageCard title="Daily verification volume" className="mb-6">
              <div className="h-56 rounded-xl bg-gradient-to-b from-slate-50/80 to-transparent px-2 pt-2">
                <MiniLineChart points={dailyVolume} />
              </div>
            </PageCard>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {metrics.map(([k, v]) => (
                <StatCard key={k} label={formatMetricLabel(k)} value={formatNumber(v)} showChart={false} />
              ))}
            </div>
          </>
        )
      )}

      <PageCard title={`Daily rollups (${daily.length})`}>
        {daily.length === 0 ? (
          <p className="py-8 text-center text-sm text-hope-secondary">
            No rollup data for this range. Run a daily rollup or re-seed the database.
          </p>
        ) : (
          <div className="space-y-3">
            {daily.map((row, i) => (
              <div
                key={row.date ?? i}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
              >
                <span className="text-sm font-semibold text-hope-dark">{formatDate(row.date)}</span>
                <span className="text-sm text-hope-secondary">
                  {formatNumber((row.metrics as { total?: unknown } | undefined)?.total)} events
                </span>
              </div>
            ))}
          </div>
        )}
      </PageCard>
    </>
  );
}
