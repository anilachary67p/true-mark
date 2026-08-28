'use client';

import { AdminShell } from '@/components/AdminShell';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, CompanyDomain, getToken, Tenant, VerificationDomain } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

function DomainsContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTenantId = useTenantId();
  const tenantId = searchParams.get('tenantId') ?? defaultTenantId;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [config, setConfig] = useState<{
    tenant: Tenant;
    companyDomains: CompanyDomain[];
    verificationDomains: VerificationDomain[];
  } | null>(null);
  const [error, setError] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [verifyHost, setVerifyHost] = useState('');
  const [verifyPath, setVerifyPath] = useState('/v');
  const [loading, setLoading] = useState(false);

  const loadConfig = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setConfig(await api.getDomainConfiguration(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    api.getTenants().then(setTenants).catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (tenantId) loadConfig(tenantId);
  }, [tenantId, loadConfig]);

  async function addCompanyDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    try {
      await api.createCompanyDomain(tenantId, companyUrl);
      setCompanyUrl('');
      await loadConfig(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add company domain');
    }
  }

  async function addVerificationDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    try {
      await api.createVerificationDomain(tenantId, {
        hostname: verifyHost,
        verificationPath: verifyPath,
        setPrimary: (config?.verificationDomains.length ?? 0) === 0,
      });
      setVerifyHost('');
      await loadConfig(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add verification domain');
    }
  }

  return (
    <AdminShell>
      <h1>Domain Configuration</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1.5rem' }}>
        Configure company and TrueMark verification domains per tenant
      </p>

      <label style={{ display: 'block', marginBottom: '1.5rem', maxWidth: 400 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Select tenant</span>
        <select
          value={tenantId}
          onChange={(e) => router.push(`/domains?tenantId=${e.target.value}`)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        >
          <option value="">Select...</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {config && (
        <>
          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 16, marginBottom: '0.5rem' }}>Tenant: {config.tenant.name}</h2>
            <p style={{ fontSize: 13, color: '#666' }}>
              Status: {config.tenant.status} · Deployment: {config.tenant.deploymentType} · Config version: {config.tenant.configVersion}
            </p>
          </section>

          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 16, marginBottom: '1rem' }}>Company Domain</h2>
            <form onSubmit={addCompanyDomain} style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <input
                type="url"
                placeholder="https://www.abcpharma.com"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                required
                style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>
                Add
              </button>
            </form>
            {config.companyDomains.map((d) => (
              <DomainRow
                key={d.id}
                label={d.url}
                status={d.status}
                version={d.version}
                actions={
                  d.status === 'PENDING' ? (
                    <button
                      onClick={() => api.activateCompanyDomain(tenantId, d.id).then(() => loadConfig(tenantId))}
                      style={{ fontSize: 12, padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4 }}
                    >
                      Activate
                    </button>
                  ) : d.status === 'ACTIVE' ? (
                    <button
                      onClick={() => api.updateCompanyDomainStatus(tenantId, d.id, 'SUSPENDED').then(() => loadConfig(tenantId))}
                      style={{ fontSize: 12, padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4 }}
                    >
                      Suspend
                    </button>
                  ) : null
                }
              />
            ))}
          </section>

          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: 8 }}>
            <h2 style={{ fontSize: 16, marginBottom: '1rem' }}>TrueMark Verification Domain</h2>
            <form onSubmit={addVerificationDomain} style={{ display: 'grid', gap: 8, marginBottom: '1rem', maxWidth: 520 }}>
              <input
                placeholder="verify.abcpharma.com"
                value={verifyHost}
                onChange={(e) => setVerifyHost(e.target.value)}
                required
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
              <input
                placeholder="/v"
                value={verifyPath}
                onChange={(e) => setVerifyPath(e.target.value)}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, width: 'fit-content' }}>
                Register Domain
              </button>
            </form>

            {config.verificationDomains.map((d) => (
              <div key={d.id} style={{ borderTop: '1px solid #eee', padding: '1rem 0' }}>
                <DomainRow
                  label={`https://${d.hostname}${d.verificationPath}`}
                  status={d.status}
                  version={d.version}
                  badge={d.isPrimary ? 'PRIMARY' : undefined}
                  actions={
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => api.verifyVerificationDomain(tenantId, d.id).then(() => loadConfig(tenantId)).catch((e) => setError(e.message))}
                            style={{ fontSize: 12, padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4 }}
                          >
                            Verify DNS
                          </button>
                          <button
                            onClick={() => api.refreshVerificationChallenge(tenantId, d.id).then(() => loadConfig(tenantId))}
                            style={{ fontSize: 12, padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4 }}
                          >
                            Refresh TXT
                          </button>
                        </>
                      )}
                      {d.status === 'ACTIVE' && !d.isPrimary && (
                        <button
                          onClick={() => api.setPrimaryVerificationDomain(tenantId, d.id).then(() => loadConfig(tenantId))}
                          style={{ fontSize: 12, padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4 }}
                        >
                          Set Primary
                        </button>
                      )}
                      {d.status === 'ACTIVE' && (
                        <button
                          onClick={() => api.updateVerificationDomainStatus(tenantId, d.id, 'SUSPENDED').then(() => loadConfig(tenantId))}
                          style={{ fontSize: 12, padding: '4px 8px', background: '#fef3c7', border: 'none', borderRadius: 4 }}
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  }
                />
                {d.dnsInstructions && d.status === 'PENDING' && (
                  <div style={{ marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 6, fontSize: 13 }}>
                    <strong>DNS TXT record</strong>
                    <div>Host: <code>{d.dnsInstructions.host}</code></div>
                    <div>Value: <code style={{ wordBreak: 'break-all' }}>{d.dnsInstructions.value}</code></div>
                    {d.dnsInstructions.expiresAt && (
                      <div style={{ color: '#888', marginTop: 4 }}>Expires: {new Date(d.dnsInstructions.expiresAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
                {d.verificationUrlExample && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Example: {d.verificationUrlExample}</div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </AdminShell>
  );
}

function DomainRow({
  label,
  status,
  version,
  badge,
  actions,
}: {
  label: string;
  status: string;
  version: number;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
      <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {status} · v{version} {badge && <span style={{ color: '#2563eb', fontWeight: 600 }}>· {badge}</span>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export default function DomainsPage() {
  return (
    <Suspense fallback={<AdminShell><p>Loading...</p></AdminShell>}>
      <DomainsContent />
    </Suspense>
  );
}
