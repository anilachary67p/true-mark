'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable, TD } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusChip } from '@/components/StatusChip';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { useAsyncData, useDebouncedValue } from '@/lib/useAsync';
import { formatDateTime, formatNumber, toFiniteNumber } from '@/lib/format';

const PAGE_SIZE = 50;

type Signal = { id: string; signalType: string; severity: string; createdAt: string };
type FraudAlert = Signal & { verificationEvent?: { publicId: string; result: string } };

function dayKey(value: string): string {
  const t = Date.parse(value);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

export default function FraudIntelligencePage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);
  const dateError = fromDate && toDate && fromDate > toDate ? 'Start date must be on or before the end date.' : '';

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [s, sig, a] = await Promise.all([
        api.getFraudSummary(tenantId),
        api.getFraudSignals(tenantId),
        api.getFraudAlerts(tenantId),
      ]);
      return {
        summary: s
          ? {
              riskScore: toFiniteNumber(s.riskScore),
              riskLevel: s.riskLevel || '—',
              totalSignals: toFiniteNumber(s.totalSignals),
            }
          : null,
        signals: (Array.isArray(sig) ? sig : []) as Signal[],
        alerts: (Array.isArray(a) ? a : []) as FraudAlert[],
      };
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const summary = data?.summary ?? null;
  const alerts = data?.alerts ?? [];
  const signals = useMemo(() => data?.signals ?? [], [data]);

  const severityOptions = useMemo(
    () => Array.from(new Set(signals.map((s) => s.severity).filter(Boolean))).sort(),
    [signals],
  );

  const filteredSignals = useMemo(() => {
    if (dateError) return [];
    return signals.filter((s) => {
      if (severity && s.severity !== severity) return false;
      if (debouncedSearch && !String(s.signalType ?? '').toLowerCase().includes(debouncedSearch)) return false;
      if (fromDate || toDate) {
        const day = dayKey(s.createdAt);
        if (!day) return false;
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
      }
      return true;
    });
  }, [signals, severity, debouncedSearch, fromDate, toDate, dateError]);

  useEffect(() => {
    setPage(0);
  }, [tenantId, severity, debouncedSearch, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredSignals.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSignals = filteredSignals.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const hasNext = pageSignals.length === PAGE_SIZE && (safePage + 1) * PAGE_SIZE < filteredSignals.length;
  const hasFilters = !!(debouncedSearch || severity || fromDate || toDate);

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  return (
    <>
      <PageHeader title="Fraud Intelligence" subtitle="Risk signals and active alerts" />

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
        data && (
          <>
            {summary && (
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Risk score"
                  value={`${Math.min(100, Math.max(0, Math.round(summary.riskScore)))}/100`}
                  color="warning"
                />
                <StatCard label="Risk level" value={summary.riskLevel} />
                <StatCard label="Total signals" value={formatNumber(summary.totalSignals)} />
              </div>
            )}

            {alerts.length > 0 && (
              <DataTable
                title="Active alerts"
                columns={['Type', 'Severity', 'Verification', 'Time']}
                rows={alerts}
                rowKey={(a, i) => a.id || `alert-${i}`}
                renderRow={(a) => (
                  <>
                    <TD>{a.signalType || '—'}</TD>
                    <TD>
                      <StatusChip status={a.severity} />
                    </TD>
                    <TD>{a.verificationEvent?.publicId ?? '—'}</TD>
                    <TD>{formatDateTime(a.createdAt)}</TD>
                  </>
                )}
              />
            )}

            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Signal type"
                placeholder="e.g. HIGH_SCAN_COUNT"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">All severities</option>
                {severityOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Input
                label="From"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {dateError && <Alert variant="warning">{dateError}</Alert>}

            <DataTable
              title="Recent signals"
              columns={['Type', 'Severity', 'Time']}
              rows={pageSignals}
              rowKey={(s, i) => s.id || `signal-${i}`}
              emptyMessage={hasFilters ? 'No fraud signals match your filters.' : 'No fraud signals recorded.'}
              renderRow={(s) => (
                <>
                  <TD>{s.signalType || '—'}</TD>
                  <TD>
                    <StatusChip status={s.severity} />
                  </TD>
                  <TD>{formatDateTime(s.createdAt)}</TD>
                </>
              )}
            />

            {filteredSignals.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-hope-secondary">
                <span>
                  Showing {formatNumber(safePage * PAGE_SIZE + 1)}–
                  {formatNumber(safePage * PAGE_SIZE + pageSignals.length)} of{' '}
                  {formatNumber(filteredSignals.length)}
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
                  <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => setPage(safePage + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
