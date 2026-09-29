'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/hooks';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { formatDateTime } from '@/lib/format';
import { isHostname, isHttpUrl, isUuid } from '@/lib/validation';

function DomainsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId: sessionTenantId, isPlatformAdmin } = useSession();
  const requestedTenantId = searchParams.get('tenantId');
  const tenantId =
    isPlatformAdmin && isUuid(requestedTenantId) ? requestedTenantId : sessionTenantId;

  const tenantsQuery = useAsyncData(() => api.getTenants(), [], { enabled: isPlatformAdmin });
  const tenants = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];

  const configQuery = useAsyncData(() => api.getDomainConfiguration(tenantId), [tenantId], {
    enabled: !!tenantId,
  });
  const config =
    configQuery.data && configQuery.data.tenant?.id === tenantId ? configQuery.data : undefined;
  const companyDomains = Array.isArray(config?.companyDomains) ? config.companyDomains : [];
  const verificationDomains = Array.isArray(config?.verificationDomains)
    ? config.verificationDomains
    : [];

  const [message, setMessage] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [companyUrlError, setCompanyUrlError] = useState('');
  const [verifyHost, setVerifyHost] = useState('');
  const [verifyHostError, setVerifyHostError] = useState('');
  const [verifyPath, setVerifyPath] = useState('/v');
  const [verifyPathError, setVerifyPathError] = useState('');
  const [activeKey, setActiveKey] = useState('');

  const addCompany = useAsyncAction((id: string, url: string) => api.createCompanyDomain(id, url));
  const addVerification = useAsyncAction(
    (id: string, data: { hostname: string; verificationPath?: string; setPrimary?: boolean }) =>
      api.createVerificationDomain(id, data),
  );
  const rowAction = useAsyncAction((fn: () => Promise<unknown>) => fn());

  async function runRowAction(
    key: string,
    fn: () => Promise<unknown>,
    successMessage: string,
    confirmMessage?: string,
  ) {
    if (!tenantId || rowAction.pending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setMessage('');
    setActiveKey(key);
    const ok = await rowAction.run(fn);
    setActiveKey('');
    if (ok) {
      setMessage(successMessage);
      configQuery.reload();
    }
  }

  async function addCompanyDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || addCompany.pending) return;
    const url = companyUrl.trim();
    if (!url || !isHttpUrl(url) || url.length > 2048) {
      setCompanyUrlError('Enter a valid http(s) URL, e.g. https://www.example.com');
      return;
    }
    setCompanyUrlError('');
    setMessage('');
    if (await addCompany.run(tenantId, url)) {
      setCompanyUrl('');
      setMessage('Company domain added');
      configQuery.reload();
    }
  }

  async function addVerificationDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || addVerification.pending) return;
    const hostname = verifyHost.trim().toLowerCase();
    const path = verifyPath.trim();
    let valid = true;
    if (!hostname || hostname.length > 253 || !isHostname(hostname)) {
      setVerifyHostError('Enter a valid hostname, e.g. verify.example.com');
      valid = false;
    } else {
      setVerifyHostError('');
    }
    if (path && (!path.startsWith('/') || /\s/.test(path) || path.length > 200)) {
      setVerifyPathError('Path must start with "/", contain no spaces and be at most 200 characters');
      valid = false;
    } else {
      setVerifyPathError('');
    }
    if (!valid) return;
    setMessage('');
    const ok = await addVerification.run(tenantId, {
      hostname,
      verificationPath: path || undefined,
      setPrimary: verificationDomains.length === 0,
    });
    if (ok) {
      setVerifyHost('');
      setMessage('Verification domain registered');
      configQuery.reload();
    }
  }

  const rowBusy = rowAction.pending;

  return (
    <>
      <PageHeader title="Domain Configuration" subtitle="Configure company and verification domains per tenant" />

      {isPlatformAdmin && (
        <div className="mb-6 max-w-md">
          {tenantsQuery.error ? (
            <Alert variant="error">
              <div className="flex items-center justify-between gap-3">
                <span>{tenantsQuery.error}</span>
                <Button size="sm" variant="outline" onClick={tenantsQuery.reload}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : (
            <Select
              label="Select tenant"
              value={tenantId ?? ''}
              disabled={tenantsQuery.loading}
              onChange={(e) =>
                router.push(
                  e.target.value
                    ? `/domains?tenantId=${encodeURIComponent(e.target.value)}`
                    : '/domains',
                )
              }
            >
              <option value="">{tenantsQuery.loading ? 'Loading…' : 'Select…'}</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          )}
        </div>
      )}

      <FeedbackAlert message={message} />
      <FeedbackAlert message={rowAction.error} severity="error" />

      {!tenantId ? (
        <PageCard>
          <EmptyState
            title={isPlatformAdmin ? 'Select a tenant' : 'No tenant assigned'}
            description={
              isPlatformAdmin
                ? 'Choose a tenant above to configure its domains.'
                : 'Your account is not linked to a tenant. Contact your platform administrator.'
            }
          />
        </PageCard>
      ) : configQuery.error ? (
        <Alert variant="error">
          <div className="flex items-center justify-between gap-3">
            <span>{configQuery.error}</span>
            <Button size="sm" variant="outline" onClick={configQuery.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : !config ? (
        <PageSkeleton />
      ) : (
        <>
          <PageCard title={`Tenant: ${config.tenant.name}`}>
            <p className="text-sm text-hope-secondary">
              Status: {config.tenant.status} · Deployment: {config.tenant.deploymentType} · Config version: {config.tenant.configVersion}
            </p>
          </PageCard>

          <PageCard title="Company domain">
            <form onSubmit={addCompanyDomain} noValidate className="mb-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="https://www.pureglow.com"
                  value={companyUrl}
                  maxLength={2048}
                  aria-invalid={!!companyUrlError}
                  onChange={(e) => {
                    setCompanyUrl(e.target.value);
                    if (companyUrlError) setCompanyUrlError('');
                  }}
                  required
                />
                {companyUrlError && <p className="mt-1 text-xs text-red-600">{companyUrlError}</p>}
              </div>
              <Button type="submit" className="shrink-0 self-start" disabled={addCompany.pending}>
                {addCompany.pending ? 'Adding…' : 'Add'}
              </Button>
            </form>
            <FeedbackAlert message={addCompany.error} severity="error" />
            {companyDomains.length === 0 ? (
              <p className="text-sm text-hope-secondary">No company domains configured yet.</p>
            ) : (
              companyDomains.map((d) => (
                <DomainRow
                  key={d.id}
                  label={d.url}
                  status={d.status}
                  version={d.version}
                  actions={
                    d.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={rowBusy}
                        onClick={() =>
                          runRowAction(
                            `company-activate-${d.id}`,
                            () => api.activateCompanyDomain(tenantId, d.id),
                            'Company domain activated',
                          )
                        }
                      >
                        {activeKey === `company-activate-${d.id}` ? 'Activating…' : 'Activate'}
                      </Button>
                    ) : d.status === 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rowBusy}
                        onClick={() =>
                          runRowAction(
                            `company-suspend-${d.id}`,
                            () => api.updateCompanyDomainStatus(tenantId, d.id, 'SUSPENDED'),
                            'Company domain suspended',
                            `Suspend company domain ${d.url}?`,
                          )
                        }
                      >
                        {activeKey === `company-suspend-${d.id}` ? 'Suspending…' : 'Suspend'}
                      </Button>
                    ) : null
                  }
                />
              ))
            )}
          </PageCard>

          <PageCard title="TrueMark verification domain">
            <form onSubmit={addVerificationDomain} noValidate className="mb-4 flex max-w-lg flex-col gap-4">
              <div>
                <Input
                  label="Hostname"
                  placeholder="verify.pureglow.com"
                  value={verifyHost}
                  maxLength={253}
                  aria-invalid={!!verifyHostError}
                  onChange={(e) => {
                    setVerifyHost(e.target.value);
                    if (verifyHostError) setVerifyHostError('');
                  }}
                  required
                />
                {verifyHostError && <p className="mt-1 text-xs text-red-600">{verifyHostError}</p>}
              </div>
              <div>
                <Input
                  label="Verification path"
                  placeholder="/v"
                  value={verifyPath}
                  maxLength={200}
                  aria-invalid={!!verifyPathError}
                  onChange={(e) => {
                    setVerifyPath(e.target.value);
                    if (verifyPathError) setVerifyPathError('');
                  }}
                />
                {verifyPathError && <p className="mt-1 text-xs text-red-600">{verifyPathError}</p>}
              </div>
              <Button type="submit" className="self-start" disabled={addVerification.pending}>
                {addVerification.pending ? 'Registering…' : 'Register domain'}
              </Button>
            </form>
            <FeedbackAlert message={addVerification.error} severity="error" />

            {verificationDomains.length === 0 && (
              <p className="text-sm text-hope-secondary">No verification domains registered yet.</p>
            )}
            {verificationDomains.map((d) => (
              <div key={d.id} className="border-t border-slate-100 py-4">
                <DomainRow
                  label={`https://${d.hostname}${d.verificationPath ?? ''}`}
                  status={d.status}
                  version={d.version}
                  badge={d.isPrimary ? 'PRIMARY' : undefined}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      {d.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={rowBusy}
                            onClick={() =>
                              runRowAction(
                                `verify-${d.id}`,
                                () => api.verifyVerificationDomain(tenantId, d.id),
                                `DNS verification requested for ${d.hostname}`,
                              )
                            }
                          >
                            {activeKey === `verify-${d.id}` ? 'Verifying…' : 'Verify DNS'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowBusy}
                            onClick={() =>
                              runRowAction(
                                `refresh-${d.id}`,
                                () => api.refreshVerificationChallenge(tenantId, d.id),
                                'DNS TXT challenge refreshed',
                              )
                            }
                          >
                            {activeKey === `refresh-${d.id}` ? 'Refreshing…' : 'Refresh TXT'}
                          </Button>
                        </>
                      )}
                      {d.status === 'ACTIVE' && !d.isPrimary && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rowBusy}
                          onClick={() =>
                            runRowAction(
                              `primary-${d.id}`,
                              () => api.setPrimaryVerificationDomain(tenantId, d.id),
                              `${d.hostname} is now the primary domain`,
                            )
                          }
                        >
                          {activeKey === `primary-${d.id}` ? 'Saving…' : 'Set primary'}
                        </Button>
                      )}
                      {d.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          disabled={rowBusy}
                          onClick={() =>
                            runRowAction(
                              `suspend-${d.id}`,
                              () => api.updateVerificationDomainStatus(tenantId, d.id, 'SUSPENDED'),
                              'Verification domain suspended',
                              d.isPrimary
                                ? `Suspend primary verification domain ${d.hostname}? QR verification links using it will stop working.`
                                : `Suspend verification domain ${d.hostname}?`,
                            )
                          }
                        >
                          {activeKey === `suspend-${d.id}` ? 'Suspending…' : 'Suspend'}
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
                        Expires: {formatDateTime(d.dnsInstructions.expiresAt)}
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
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="break-all font-medium text-hope-dark">{label}</p>
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
