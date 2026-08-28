'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { DateRangeValue, formatRangeLabel } from '@/lib/dateRange';

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

export function PlatformDashboard() {
  const [range, setRange] = useState<DateRangeValue>(() => getDefaultDateRange(30));
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [drillDown, setDrillDown] = useState<TenantDrillDown | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);

  const load = useCallback(async (nextRange: DateRangeValue) => {
    setLoading(true);
    try {
      setData(await api.getPlatformDashboard(nextRange));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenant = useCallback(
    async (tenantId: string, nextRange: DateRangeValue) => {
      setDrillLoading(true);
      try {
        setDrillDown(await api.getPlatformTenantDashboard(tenantId, nextRange));
        setSelectedTenantId(tenantId);
      } finally {
        setDrillLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  useEffect(() => {
    if (selectedTenantId) loadTenant(selectedTenantId, range);
  }, [selectedTenantId, range, loadTenant]);

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Platform Dashboard" subtitle="Cross-tenant statistics and insights" />
        <StatCardsSkeleton count={4} />
      </>
    );
  }

  if (!data) return null;

  const volume = data.dailyVolume.map((d) => d.count);
  const prevVolume = data.previousDailyVolume.map((d) => d.count);
  const tenantBars = data.tenantBreakdown.slice(0, 8).map((t) => t.verifications);

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

      <p className="mb-4 text-xs text-hope-muted">
        Comparing {formatRangeLabel(range)} vs previous period (
        {new Date(data.previousDateRange.from).toLocaleDateString()} –{' '}
        {new Date(data.previousDateRange.to).toLocaleDateString()})
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeltaStatCard label="Organizations" metric={data.totals.tenants} accent="primary" />
        <DeltaStatCard label="Active tenants (with scans)" metric={data.totals.activeTenants} accent="info" />
        <DeltaStatCard label="Total verifications" metric={data.totals.verifications} accent="primary" />
        <DeltaStatCard label="Verified" metric={data.totals.verified} accent="success" />
        <DeltaStatCard label="Suspicious" metric={data.totals.suspicious} accent="warning" />
        <DeltaStatCard label="Product variants" metric={data.totals.variants} accent="info" />
        <DeltaStatCard label="Product types" metric={data.totals.productTypes} />
        <DeltaStatCard label="Open investigations" metric={data.totals.openInvestigations} accent="error" />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-12">
        <PageCard className="xl:col-span-8" title="Verification volume (all tenants)">
          <div className="mb-3 flex gap-4 text-xs text-hope-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-hope-primary" /> Current period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-400" /> Previous period
            </span>
          </div>
          <div className="h-56">
            <MiniLineChart points={volume} points2={prevVolume} />
          </div>
        </PageCard>

        <PageCard className="xl:col-span-4" title="By deployment model">
          <div className="space-y-3">
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
                      width: `${Math.round((d.count / Math.max(data.totals.tenants.current, 1)) * 100)}%`,
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
          <MiniBarChart values={tenantBars} />
          <div className="mt-3 space-y-1">
            {data.tenantBreakdown.slice(0, 8).map((t) => (
              <div key={t.tenantId} className="flex justify-between text-xs text-hope-secondary">
                <span className="truncate">{t.tenantName}</span>
                <span className="font-semibold text-hope-dark">{t.verifications}</span>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Result distribution">
          <div className="space-y-2">
            {data.resultDistribution
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map((r) => {
                const delta = r.count - r.previous;
                const pct = r.previous > 0 ? Math.round((delta / r.previous) * 100) : r.count > 0 ? 100 : 0;
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
        <Table>
          <THead>
            <TR>
              <TH>Organization</TH>
              <TH>Status</TH>
              <TH>Deployment</TH>
              <TH>Verifications</TH>
              <TH>Verified</TH>
              <TH>Suspicious</TH>
              <TH>Catalog</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {data.tenantBreakdown.map((t) => (
              <TR
                key={t.tenantId}
                className={selectedTenantId === t.tenantId ? 'bg-hope-primary/5' : 'cursor-pointer hover:bg-slate-50'}
                onClick={() => loadTenant(t.tenantId, range)}
              >
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
                  {t.catalog.categories} cat · {t.catalog.productTypes} types · {t.catalog.variants} variants
                </TD>
                <TD>
                  <ChevronRight className="h-4 w-4 text-hope-muted" />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </PageCard>

      {drillLoading && (
        <div className="mt-6">
          <StatCardsSkeleton count={3} />
        </div>
      )}

      {drillDown && !drillLoading && (
        <div className="mt-6 space-y-5">
          <PageHeader
            title={drillDown.tenant.name}
            subtitle={`Tenant drill-down · ${drillDown.tenant.deploymentType}`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <DeltaStatCard label="Verifications" metric={drillDown.totals.verifications} />
            <DeltaStatCard label="Verified" metric={drillDown.totals.verified} accent="success" />
            <DeltaStatCard label="Suspicious" metric={drillDown.totals.suspicious} accent="warning" />
            <DeltaStatCard label="AI jobs" metric={drillDown.totals.aiJobsCompleted} accent="info" />
            <PageCard>
              <p className="text-sm text-hope-secondary">Catalog</p>
              <p className="mt-2 text-lg font-bold text-hope-dark">
                {drillDown.catalog.categories} / {drillDown.catalog.productTypes} / {drillDown.catalog.variants}
              </p>
              <p className="text-[10px] text-hope-muted">Categories · Types · Variants</p>
            </PageCard>
          </div>
          <PageCard title={`${drillDown.tenant.name} — verification trend`}>
            <div className="h-48">
              <MiniLineChart
                points={drillDown.dailyVolume.map((d) => d.count)}
                points2={drillDown.previousDailyVolume.map((d) => d.count)}
              />
            </div>
          </PageCard>
        </div>
      )}
    </>
  );
}
