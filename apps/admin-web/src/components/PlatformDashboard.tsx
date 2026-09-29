'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatCardsSkeleton } from '@/components/PageSkeleton';
import { DeltaStatCard, type MetricDelta } from '@/components/DeltaStatCard';
import { DateRangePicker, getDefaultDateRange } from '@/components/DateRangePicker';
import { MiniLineChart } from '@/components/ui/MiniLineChart';
import { MiniBarChart } from '@/components/ui/MiniBarChart';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/StatusChip';
import { TD } from '@/components/ui/Table';
import { VirtualizedTable } from '@/components/ui/VirtualizedTable';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';
import { formatDate, percentOf, toFiniteNumber } from '@/lib/format';
import { useAsyncData } from '@/lib/useAsync';

type PlatformDashboardData = {
  dateRange: { from: string; to: string };
  previousDateRange: { from: string; to: string };
  totals: Record<string, MetricDelta>;
  dailyVolume: Array<{ date: string; count: number }>;
  previousDailyVolume: Array<{ date: string; count: number }>;
  resultDistribution: Array<{ result: string; count: number; previous: number }>;
  tenantsByDeployment: Array<{ deploymentType: string; count: number }>;
  tenantBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    status: string;
    deploymentType: string;
    verifications: number;
    verified: number;
    suspicious: number;
    verificationRate: number;
    catalog: { categories: number; productTypes: number; variants: number; tags: number };
  }>;
};

type TenantDrillDown = {
  tenant: { id: string; name: string; status: string; deploymentType: string };
  totals: Record<string, MetricDelta>;
  dailyVolume: Array<{ date: string; count: number }>;
  previousDailyVolume: Array<{ date: string; count: number }>;
  catalog: { categories: number; productTypes: number; variants: number; tags: number };
};

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function counts(series: unknown): number[] {
  return list<{ count?: unknown }>(series).map((d) => toFiniteNumber(d?.count));
}

function normalizeCatalog(value: unknown): TenantDrillDown['catalog'] {
  const c = (value ?? {}) as Partial<TenantDrillDown['catalog']>;
  return {
    categories: toFiniteNumber(c.categories),
    productTypes: toFiniteNumber(c.productTypes),
    variants: toFiniteNumber(c.variants),
    tags: toFiniteNumber(c.tags),
  };
}

function normalizeDashboard(raw: Partial<PlatformDashboardData> | null | undefined): PlatformDashboardData {
  return {
    dateRange: raw?.dateRange ?? { from: '', to: '' },
    previousDateRange: raw?.previousDateRange ?? { from: '', to: '' },
    totals: raw?.totals ?? {},
    dailyVolume: list(raw?.dailyVolume),
    previousDailyVolume: list(raw?.previousDailyVolume),
    resultDistribution: list<PlatformDashboardData['resultDistribution'][number]>(raw?.resultDistribution).map((r) => ({
      result: String(r?.result ?? 'UNKNOWN'),
      count: toFiniteNumber(r?.count),
      previous: toFiniteNumber(r?.previous),
    })),
    tenantsByDeployment: list<PlatformDashboardData['tenantsByDeployment'][number]>(raw?.tenantsByDeployment).map((d) => ({
      deploymentType: String(d?.deploymentType ?? 'UNKNOWN'),
      count: toFiniteNumber(d?.count),
    })),
    tenantBreakdown: list<PlatformDashboardData['tenantBreakdown'][number]>(raw?.tenantBreakdown).map((t) => ({
      tenantId: String(t?.tenantId ?? ''),
      tenantName: String(t?.tenantName ?? 'Unnamed organization'),
      status: String(t?.status ?? 'UNKNOWN'),
      deploymentType: String(t?.deploymentType ?? '—'),
      verifications: toFiniteNumber(t?.verifications),
      verified: toFiniteNumber(t?.verified),
      suspicious: toFiniteNumber(t?.suspicious),
      verificationRate: toFiniteNumber(t?.verificationRate),
      catalog: normalizeCatalog(t?.catalog),
    })),
  };
}

export function PlatformDashboard() {
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const dashboard = useAsyncData(
    async () => normalizeDashboard(await api.getPlatformDashboard(range)),
    [range.from, range.to],
  );
  const drill = useAsyncData(
    () => api.getPlatformTenantDashboard(selectedTenantId!, range) as Promise<TenantDrillDown>,
    [selectedTenantId, range.from, range.to],
    { enabled: !!selectedTenantId },
  );
  const data = dashboard.data;
  const drillDown = selectedTenantId && drill.data?.tenant ? drill.data : null;
  const drillLoading = drill.loading;

  if (dashboard.loading && !data) {
    return (
      <>
        <PageHeader title="Platform Dashboard" subtitle="Cross-tenant statistics and insights" />
        <StatCardsSkeleton count={4} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Platform Dashboard" subtitle="Cross-tenant statistics and insights" />
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{dashboard.error || 'Dashboard data is unavailable.'}</span>
            <Button size="sm" variant="outline" onClick={dashboard.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      </>
    );
  }

  const volume = counts(data.dailyVolume);
  const prevVolume = counts(data.previousDailyVolume);
  const topTenants = data.tenantBreakdown.slice(0, 8);
  const tenantBars = topTenants.map((t) => t.verifications);
  const tenantLabels = topTenants.map((t) => t.tenantName.split(' ')[0] || t.tenantName);
  const tenantTotal = Math.max(toFiniteNumber(data.totals.tenants?.current), 1);
  const distribution = [...data.resultDistribution].sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        subtitle="Manage tenants and monitor platform-wide performance"
        action={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Link href="/organizations">
              <Button size="sm">
                <Building2 className="h-4 w-4" />
                Organizations
              </Button>
            </Link>
          </>
        }
      />

      {dashboard.error && (
        <Alert variant="warning" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Showing the last loaded data. {dashboard.error}</span>
            <Button size="sm" variant="outline" onClick={dashboard.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <p className="mb-4 text-xs text-hope-muted">
        Comparing {formatRangeLabel(range)} vs previous period ({formatDate(data.previousDateRange.from)} –{' '}
        {formatDate(data.previousDateRange.to)})
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeltaStatCard label="Organizations" metric={data.totals.tenants} accent="primary" />
        <DeltaStatCard
          label="Active tenants (with scans)"
          metric={data.totals.activeTenants}
          accent="info"
        />
        <DeltaStatCard
          label="Total verifications"
          metric={data.totals.verifications}
          accent="primary"
        />
        <DeltaStatCard label="Verified" metric={data.totals.verified} accent="success" />
        <DeltaStatCard label="Suspicious" metric={data.totals.suspicious} accent="warning" />
        <DeltaStatCard label="Product variants" metric={data.totals.variants} accent="info" />
        <DeltaStatCard label="Product types" metric={data.totals.productTypes} />
        <DeltaStatCard
          label="Open investigations"
          metric={data.totals.openInvestigations}
          accent="error"
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-12">
        <PageCard className="xl:col-span-8" title="Verification volume (all tenants)">
          <div className="mb-3 flex gap-4 text-xs text-hope-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-hope-primary" /> Current period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-400" />{' '}
              Previous period
            </span>
          </div>
          <div className="h-56 rounded-xl bg-gradient-to-b from-slate-50/80 to-transparent px-2 pt-2">
            <MiniLineChart points={volume} points2={prevVolume} />
          </div>
        </PageCard>

        <PageCard className="xl:col-span-4" title="By deployment model">
          <div className="space-y-3">
            {data.tenantsByDeployment.length === 0 && (
              <p className="text-xs text-hope-muted">No organizations yet.</p>
            )}
            {data.tenantsByDeployment.map((d) => (
              <div key={d.deploymentType}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-hope-secondary">{d.deploymentType}</span>
                  <span className="font-semibold">{d.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-hope-primary"
                    style={{
                      width: `${Math.round(percentOf(d.count, tenantTotal))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <PageCard title="Top tenants by verifications">
          <MiniBarChart values={tenantBars} labels={tenantLabels} height={128} />
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
            {topTenants.map((t) => (
              <div key={t.tenantId} className="flex justify-between text-xs text-hope-secondary">
                <span className="truncate">{t.tenantName}</span>
                <span className="font-semibold text-hope-dark">{t.verifications}</span>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Result distribution">
          <div className="space-y-2">
            {distribution.length === 0 && <p className="text-xs text-hope-muted">No verifications in this period.</p>}
            {distribution.map((r) => {
                const delta = r.count - r.previous;
                const pct =
                  r.previous > 0 ? Math.round((delta / r.previous) * 100) : r.count > 0 ? 100 : 0;
                return (
                  <div key={r.result} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-hope-secondary">{r.result.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.count}</span>
                      <span
                        className={`text-[10px] font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {delta >= 0 ? '+' : ''}
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </PageCard>
      </div>

      <PageCard noPadding title="Tenant breakdown — click a row for detailed stats">
        <VirtualizedTable
          columns={[
            'Organization',
            'Status',
            'Deployment',
            'Verifications',
            'Verified',
            'Suspicious',
            'Catalog',
            '',
          ]}
          rows={data.tenantBreakdown}
          rowKey={(t) => t.tenantId}
          maxHeight={420}
          getRowProps={(t) => ({
            className:
              selectedTenantId === t.tenantId
                ? 'cursor-pointer bg-hope-primary/5'
                : 'cursor-pointer hover:bg-slate-50',
            onClick: () => setSelectedTenantId(t.tenantId),
          })}
          renderRow={(t) => (
            <>
              <TD>
                <p className="font-semibold text-hope-dark">{t.tenantName}</p>
              </TD>
              <TD>
                <StatusChip status={t.status} />
              </TD>
              <TD className="text-xs">{t.deploymentType}</TD>
              <TD>{t.verifications.toLocaleString()}</TD>
              <TD>{t.verified.toLocaleString()}</TD>
              <TD>{t.suspicious.toLocaleString()}</TD>
              <TD className="text-xs text-hope-secondary">
                {t.catalog.categories} cat · {t.catalog.productTypes} types · {t.catalog.variants}{' '}
                variants
              </TD>
              <TD>
                <ChevronRight className="h-4 w-4 text-hope-muted" />
              </TD>
            </>
          )}
        />
      </PageCard>

      {selectedTenantId && drillLoading && (
        <div className="mt-6">
          <StatCardsSkeleton count={3} />
        </div>
      )}

      {selectedTenantId && !drillLoading && drill.error && (
        <Alert variant="error" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{drill.error}</span>
            <Button size="sm" variant="outline" onClick={drill.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {drillDown && !drillLoading && !drill.error && (
        <div className="mt-6 space-y-5">
          <PageHeader
            title={drillDown.tenant.name}
            subtitle={`Tenant drill-down · ${drillDown.tenant.deploymentType}`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <DeltaStatCard label="Verifications" metric={drillDown.totals?.verifications} />
            <DeltaStatCard label="Verified" metric={drillDown.totals?.verified} accent="success" />
            <DeltaStatCard
              label="Suspicious"
              metric={drillDown.totals?.suspicious}
              accent="warning"
            />
            <DeltaStatCard
              label="AI jobs"
              metric={drillDown.totals?.aiJobsCompleted}
              accent="info"
            />
            <PageCard>
              <p className="text-sm text-hope-secondary">Catalog</p>
              <p className="mt-2 text-lg font-bold text-hope-dark">
                {normalizeCatalog(drillDown.catalog).categories} / {normalizeCatalog(drillDown.catalog).productTypes} /{' '}
                {normalizeCatalog(drillDown.catalog).variants}
              </p>
              <p className="text-[10px] text-hope-muted">Categories · Types · Variants</p>
            </PageCard>
          </div>
          <PageCard title={`${drillDown.tenant.name} — verification trend`}>
            <div className="h-52 rounded-xl bg-gradient-to-b from-slate-50/80 to-transparent px-2 pt-2">
              <MiniLineChart
                points={counts(drillDown.dailyVolume)}
                points2={counts(drillDown.previousDailyVolume)}
              />
            </div>
          </PageCard>
        </div>
      )}
    </>
  );
}
