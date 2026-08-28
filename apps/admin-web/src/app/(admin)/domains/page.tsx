'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
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
    <>
      <PageHeader title="Domain Configuration" subtitle="Configure company and verification domains per tenant" />

      <div className="mb-6 max-w-md">
        <Select
          label="Select tenant"
          value={tenantId ?? ''}
          onChange={(e) => router.push(`/domains?tenantId=${e.target.value}`)}
        >
          <option value="">Select…</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>

      <FeedbackAlert message={error} severity="error" />
      {loading && <PageSkeleton />}

      {config && (
        <>
          <PageCard title={`Tenant: ${config.tenant.name}`}>
            <p className="text-sm text-hope-secondary">
              Status: {config.tenant.status} · Deployment: {config.tenant.deploymentType} · Config version: {config.tenant.configVersion}
            </p>
          </PageCard>

          <PageCard title="Company domain">
            <form onSubmit={addCompanyDomain} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="url"
                placeholder="https://www.pureglow.com"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" className="shrink-0 self-end">Add</Button>
            </form>
            {config.companyDomains.map((d) => (
              <DomainRow
                key={d.id}
                label={d.url}
                status={d.status}
                version={d.version}
                actions={
                  d.status === 'PENDING' ? (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => api.activateCompanyDomain(tenantId, d.id).then(() => loadConfig(tenantId))}>
                      Activate
                    </Button>
                  ) : d.status === 'ACTIVE' ? (
                    <Button size="sm" variant="outline" onClick={() => api.updateCompanyDomainStatus(tenantId, d.id, 'SUSPENDED').then(() => loadConfig(tenantId))}>
                      Suspend
                    </Button>
                  ) : null
                }
              />
            ))}
          </PageCard>

          <PageCard title="TrueMark verification domain">
            <form onSubmit={addVerificationDomain} className="mb-4 flex max-w-lg flex-col gap-4">
              <Input
                label="Hostname"
                placeholder="verify.pureglow.com"
                value={verifyHost}
                onChange={(e) => setVerifyHost(e.target.value)}
                required
              />
              <Input
                label="Verification path"
                placeholder="/v"
                value={verifyPath}
                onChange={(e) => setVerifyPath(e.target.value)}
              />
              <Button type="submit" className="self-start">
                Register domain
              </Button>
            </form>

            {config.verificationDomains.map((d) => (
              <div key={d.id} className="border-t border-slate-100 py-4">
                <DomainRow
                  label={`https://${d.hostname}${d.verificationPath}`}
                  status={d.status}
                  version={d.version}
                  badge={d.isPrimary ? 'PRIMARY' : undefined}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      {d.status === 'PENDING' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => api.verifyVerificationDomain(tenantId, d.id).then(() => loadConfig(tenantId)).catch((e) => setError(e.message))}>
                            Verify DNS
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => api.refreshVerificationChallenge(tenantId, d.id).then(() => loadConfig(tenantId))}>
                            Refresh TXT
                          </Button>
                        </>
                      )}
                      {d.status === 'ACTIVE' && !d.isPrimary && (
                        <Button size="sm" variant="outline" onClick={() => api.setPrimaryVerificationDomain(tenantId, d.id).then(() => loadConfig(tenantId))}>
                          Set primary
                        </Button>
                      )}
                      {d.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => api.updateVerificationDomainStatus(tenantId, d.id, 'SUSPENDED').then(() => loadConfig(tenantId))}>
                          Suspend
                        </Button>
                      )}
                    </div>
                  }
                />
                {d.dnsInstructions && d.status === 'PENDING' && (
                  <Alert variant="info" className="mt-2">
                    <p className="font-semibold">DNS TXT record</p>
                    <p>Host: <code className="rounded bg-sky-100 px-1">{d.dnsInstructions.host}</code></p>
                    <p className="break-all">Value: <code className="rounded bg-sky-100 px-1">{d.dnsInstructions.value}</code></p>
                    {d.dnsInstructions.expiresAt && (
                      <p className="mt-1 text-xs opacity-75">
                        Expires: {new Date(d.dnsInstructions.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </Alert>
                )}
                {d.verificationUrlExample && (
                  <p className="mt-1 text-xs text-hope-secondary">
                    Example: {d.verificationUrlExample}
                  </p>
                )}
              </div>
            ))}
          </PageCard>
        </>
      )}
    </>
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
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-hope-dark">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <StatusChip status={status} />
          <span className="text-xs text-hope-secondary">v{version}</span>
          {badge && <Badge status={badge} />}
        </div>
      </div>
      {actions}
    </div>
  );
}

export default function DomainsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DomainsContent />
    </Suspense>
  );
}
