'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusChip } from '@/components/StatusChip';
import { TR, TD } from '@/components/ui/Table';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function FraudIntelligencePage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [summary, setSummary] = useState<{
    riskScore: number;
    riskLevel: string;
    totalSignals: number;
  } | null>(null);
  const [signals, setSignals] = useState<
    Array<{ id: string; signalType: string; severity: string; createdAt: string }>
  >([]);
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      signalType: string;
      severity: string;
      createdAt: string;
      verificationEvent?: { publicId: string; result: string };
    }>
  >([]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (!tenantId) return;
    Promise.all([
      api.getFraudSummary(tenantId),
      api.getFraudSignals(tenantId),
      api.getFraudAlerts(tenantId),
    ]).then(([s, sig, a]) => {
      setSummary(s);
      setSignals(sig);
      setAlerts(a);
    });
  }, [router, tenantId]);

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader title="Fraud Intelligence" subtitle="Risk signals and active alerts" />

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Risk score" value={`${summary.riskScore}/100`} color="warning" />
          <StatCard label="Risk level" value={summary.riskLevel} />
          <StatCard label="Total signals" value={summary.totalSignals} />
        </div>
      )}

      {alerts.length > 0 && (
        <DataTable title="Active alerts" columns={['Type', 'Severity', 'Verification', 'Time']}>
          {alerts.map((a) => (
            <TR key={a.id}>
              <TD>{a.signalType}</TD>
              <TD>
                <StatusChip status={a.severity} />
              </TD>
              <TD>{a.verificationEvent?.publicId ?? '—'}</TD>
              <TD>{new Date(a.createdAt).toLocaleString()}</TD>
            </TR>
          ))}
        </DataTable>
      )}

      <DataTable
        title="Recent signals"
        columns={['Type', 'Severity', 'Time']}
        isEmpty={signals.length === 0}
        emptyMessage="No fraud signals recorded."
      >
        {signals.map((s) => (
          <TR key={s.id}>
            <TD>{s.signalType}</TD>
            <TD>
              <StatusChip status={s.severity} />
            </TD>
            <TD>{new Date(s.createdAt).toLocaleString()}</TD>
          </TR>
        ))}
      </DataTable>
    </>
  );
}
