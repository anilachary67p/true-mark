'use client';

import Link from 'next/link';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatCardsSkeleton } from '@/components/PageSkeleton';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/Button';
import { MiniLineChart } from '@/components/ui/MiniLineChart';
import { Badge } from '@/components/ui/Badge';
import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  Copy,
  ScanLine,
  BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTenantId } from '@/lib/hooks';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';

function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-hope-secondary">{label}</span>
        <span className="font-semibold text-hope-dark">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const tenantId = useTenantId();
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'verifications' | 'suspicious'>('verifications');

  const load = useCallback(
    async (tid: string, nextRange: DateRangeValue) => {
      setLoading(true);
      try {
        const dashboard = await api.getDashboard(tid, nextRange);
        setData(dashboard);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!tenantId) return;
    load(tenantId, range);
  }, [tenantId, range, load]);

  if (!tenantId || (loading && !data)) {
    return (
      <>
        <PageHeader title="Quick Insights" subtitle="Verification dashboard overview" />
        <StatCardsSkeleton count={3} />
      </>
    );
  }

  if (!data) return null;

  const total = Number(data.totalVerifications ?? 0);
  const verified = Number(data.verified ?? 0);
  const suspicious = Number(data.suspicious ?? 0) + Number(data.possibleClone ?? 0);
  const dailyVolume = Array.isArray(data.dailyVolume)
    ? (data.dailyVolume as Array<{ date: string; count: number }>).map((d) => d.count)
    : [];

  const primaryCards = [
    {
      label: 'Total Verifications',
      value: total,
      color: 'primary' as const,
      icon: BadgeCheck,
      footer: formatRangeLabel(range),
    },
    {
      label: 'Verified',
      value: verified,
      color: 'success' as const,
      icon: CheckCircle,
      footer: 'Authentic products confirmed',
    },
    {
      label: 'Suspicious',
      value: suspicious,
      color: 'warning' as const,
      icon: AlertTriangle,
      footer: 'Needs review',
    },
  ];

  const secondaryCards = [
    { label: 'Reverified', value: data.reverified, icon: RotateCcw, color: 'info' as const },
    { label: 'Possible Clone', value: data.possibleClone, icon: Copy, color: 'error' as const },
    { label: 'Invalid QR', value: data.invalidQr, icon: ScanLine, color: 'secondary' as const },
  ];

  const recent = Array.isArray(data.recentVerifications) ? data.recentVerifications : [];
  const filteredRecent =
    tab === 'suspicious'
      ? recent.filter((item: Record<string, unknown>) =>
          ['SUSPICIOUS', 'POSSIBLE_CLONE', 'INVALID_QR', 'UNKNOWN_QR'].includes(
            String(item.result),
          ),
        )
      : recent;

  return (
    <>
      <PageHeader
        title="Quick Insights"
        subtitle="Verification dashboard overview"
        action={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-hope-secondary">
              <span className="h-2 w-2 rounded-full bg-hope-success" />
              Online
            </span>
            <Link href="/analytics">
              <Button size="sm">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        {primaryCards.map((c) => (
          <StatCard key={c.label} {...c} value={String(c.value)} />
        ))}
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-12">
        <PageCard className="xl:col-span-7" title="Verification Volume">
          <div className="h-52">
            <MiniLineChart points={dailyVolume} />
          </div>
        </PageCard>

        <div className="grid gap-5 xl:col-span-5">
          <PageCard title={`Period total (${formatRangeLabel(range)})`}>
            <p className="mb-4 text-3xl font-bold text-hope-dark">{total.toLocaleString()}</p>
            <div className="space-y-4">
              <ProgressBar label="Verified" value={verified} max={total} color="bg-hope-purple" />
              <ProgressBar
                label="Reverified"
                value={Number(data.reverified ?? 0)}
                max={total}
                color="bg-hope-teal"
              />
              <ProgressBar
                label="Suspicious"
                value={suspicious}
                max={total}
                color="bg-hope-warning"
              />
            </div>
          </PageCard>

          <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-1">
            {secondaryCards.map((c) => (
              <StatCard
                key={c.label}
                label={c.label}
                value={String(c.value ?? 0)}
                color={c.color}
                icon={c.icon}
                showChart={false}
              />
            ))}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <PageCard noPadding>
          <div className="border-b border-slate-100 px-5 pt-4">
            <div className="flex gap-6">
              {(['verifications', 'suspicious'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`border-b-2 pb-3 text-sm font-semibold capitalize transition ${
                    tab === t
                      ? 'border-hope-primary text-hope-primary'
                      : 'border-transparent text-hope-secondary hover:text-hope-dark'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {filteredRecent.slice(0, 8).map((item: Record<string, unknown>, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-hope-primary/5"
              >
                <div>
                  <p className="text-sm font-semibold text-hope-primary">
                    {String(item.publicId ?? `scan_${i}`).slice(0, 24)}
                  </p>
                  <p className="text-xs text-hope-muted">{String(item.method ?? 'QR scan')}</p>
                </div>
                <div className="text-right">
                  <Badge status={String(item.result ?? 'PENDING')} />
                  <p className="mt-1 text-[11px] text-hope-muted">
                    {item.createdAt
                      ? new Date(String(item.createdAt)).toLocaleString()
                      : 'Recently'}
                  </p>
                </div>
              </div>
            ))}
            {filteredRecent.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-hope-secondary">
                No records in this tab for the selected range.
              </p>
            )}
          </div>
        </PageCard>
      )}
    </>
  );
}
