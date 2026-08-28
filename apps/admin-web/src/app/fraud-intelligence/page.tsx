'use client';

import { AdminShell } from '@/components/AdminShell';
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

  return (
    <AdminShell>
      <h1>Fraud Intelligence</h1>
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <Metric label="Risk score" value={`${summary.riskScore}/100`} />
          <Metric label="Risk level" value={summary.riskLevel} />
          <Metric label="Total signals" value={String(summary.totalSignals)} />
        </div>
      )}
      {alerts.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Active alerts</h2>
          <table
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: 8,
              borderCollapse: 'collapse',
              marginBottom: '1.5rem',
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Severity</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Verification</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: 8 }}>{a.signalType}</td>
                  <td style={{ padding: 8, color: a.severity === 'HIGH' ? '#dc2626' : '#d97706' }}>
                    {a.severity}
                  </td>
                  <td style={{ padding: 8, fontSize: 13 }}>
                    {a.verificationEvent?.publicId ?? '—'}
                  </td>
                  <td style={{ padding: 8 }}>{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Recent signals</h2>
      <table
        style={{ width: '100%', background: '#fff', borderRadius: 8, borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Severity</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: 8 }}>{s.signalType}</td>
              <td style={{ padding: 8 }}>{s.severity}</td>
              <td style={{ padding: 8 }}>{new Date(s.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
      <div style={{ color: '#666', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
