'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/Button';
import { MiniLineChart } from '@/components/ui/MiniLineChart';
import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';
import { RefreshCw } from 'lucide-react';

function formatMetricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function AnalyticsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [daily, setDaily] = useState<Array<{ date: string; metrics: Record<string, unknown> }>>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (tid: string, nextRange: DateRangeValue) => {
    setLoading(true);
    try {
      const [dash, rollups] = await Promise.all([
        api.getDashboard(tid, nextRange),
        api.getAnalyticsDaily(tid, nextRange),
      ]);
      setDashboard(dash);
      setDaily(rollups);
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

  const metrics = dashboard
    ? Object.entries(dashboard).filter(
        ([k]) => !['recentVerifications', 'dailyVolume', 'dateRange'].includes(k),
      )
    : [];

  const dailyVolume = Array.isArray(dashboard?.dailyVolume)
    ? (dashboard.dailyVolume as Array<{ date: string; count: number }>).map((d) => d.count)
    : [];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Verification metrics for ${formatRangeLabel(range)}`}
        action={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button
              variant="outline"
              onClick={async () => {
                await api.triggerAnalyticsRollup(tenantId);
                setMessage('Daily rollup triggered');
                load(tenantId, range);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Run daily rollup
            </Button>
          </>
        }
      />
      <FeedbackAlert message={message} />

      {loading && !dashboard ? (
        <PageSkeleton />
      ) : (
        dashboard && (
          <>
            <PageCard title="Daily verification volume" className="mb-6">
              <div className="h-52">
                <MiniLineChart points={dailyVolume} />
              </div>
            </PageCard>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {metrics.map(([k, v]) => (
                <StatCard key={k} label={formatMetricLabel(k)} value={String(v)} showChart={false} />
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
            {daily.map((row) => (
              <div
                key={row.date}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
              >
                <span className="text-sm font-semibold text-hope-dark">
                  {new Date(row.date).toLocaleDateString()}
                </span>
                <span className="text-sm text-hope-secondary">
                  {String((row.metrics as { total?: number }).total ?? 0)} events
                </span>
              </div>
            ))}
          </div>
        )}
      </PageCard>
    </>
  );
}
