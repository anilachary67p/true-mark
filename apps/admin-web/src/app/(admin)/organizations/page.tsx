'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StatCard } from '@/components/StatCard';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import { api, getToken, Tenant } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';

const DEPLOYMENT_HELP: Record<string, string> = {
  SAAS: 'Multi-tenant SaaS — shared TrueMark platform',
  DEDICATED_CLOUD: 'Dedicated deployment — isolated stack in cloud',
  CUSTOMER_CLOUD: 'Dedicated deployment — customer cloud account',
  ON_PREM: 'Dedicated deployment — customer datacenter',
  HYBRID: 'Dedicated deployment — on-prem core + optional cloud AI',
};

export default function OrganizationsPage() {
  useAuthGuard();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [licenses, setLicenses] = useState<
    Array<{ tenantId: string; commercialModel: string; validUntil: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    deploymentType: 'SAAS',
    commercialModel: 'FULL_PRODUCT',
    licenseValidDays: '365',
  });
  const [creating, setCreating] = useState(false);
  const [platformOverview, setPlatformOverview] = useState<
    Awaited<ReturnType<typeof api.getPlatformOverview>> | null
  >(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantCatalog, setTenantCatalog] = useState<
    Awaited<ReturnType<typeof api.getCatalogStats>> | null
  >(null);

  async function load() {
    try {
      const [tenantList, licenseList, overview] = await Promise.all([
        api.getTenants(),
        api.listPlatformLicenses().catch(() => []),
        api.getPlatformOverview().catch(() => null),
      ]);
      setTenants(tenantList);
      setLicenses(licenseList);
      setPlatformOverview(overview);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    load();
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createTenant({
        name: form.name,
        legalName: form.legalName || undefined,
        deploymentType: form.deploymentType,
        commercialModel: form.commercialModel,
        licenseValidDays: Number(form.licenseValidDays),
      });
      setShowCreate(false);
      setForm({
        name: '',
        legalName: '',
        deploymentType: 'SAAS',
        commercialModel: 'FULL_PRODUCT',
        licenseValidDays: '365',
      });
      setMessage('Tenant created with signed license');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  }

  function licenseFor(tenantId: string) {
    return licenses.find((l) => l.tenantId === tenantId);
  }

  function catalogFor(tenantId: string) {
    return platformOverview?.tenants.find((t) => t.id === tenantId)?.catalog;
  }

  async function showTenantCatalog(tenantId: string) {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
      setTenantCatalog(null);
      return;
    }
    setExpandedTenantId(tenantId);
    setTenantCatalog(await api.getCatalogStats(tenantId));
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="Super Admin — onboard tenants, view platform statistics, and manage licenses"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        }
      />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={error} severity="error" />

      {platformOverview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Tenants" value={platformOverview.totals.tenants} showChart={false} />
          <StatCard label="Categories" value={platformOverview.totals.categories} showChart={false} />
          <StatCard label="Product types" value={platformOverview.totals.productTypes} showChart={false} />
          <StatCard label="Variants" value={platformOverview.totals.variants} showChart={false} />
          <StatCard label="Tags" value={platformOverview.totals.tags} showChart={false} />
        </div>
      )}

      {showCreate && (
        <PageCard title="New Tenant">
          <form onSubmit={handleCreate} className="grid max-w-2xl gap-4 md:grid-cols-2">
            <Input
              label="Company name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Legal name"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
            <Select
              label="Deployment model"
              value={form.deploymentType}
              onChange={(e) => setForm({ ...form, deploymentType: e.target.value })}
            >
              <option value="SAAS">Multi-tenant SaaS</option>
              <option value="DEDICATED_CLOUD">Dedicated Cloud</option>
              <option value="CUSTOMER_CLOUD">Customer Cloud</option>
              <option value="ON_PREM">On-Premises</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
            <Select
              label="Commercial model"
              value={form.commercialModel}
              onChange={(e) => setForm({ ...form, commercialModel: e.target.value })}
            >
              <option value="FULL_PRODUCT">Full Product (X + N)</option>
              <option value="MANAGED_SERVICE">Managed Service (N)</option>
            </Select>
            <Input
              label="License validity (days)"
              type="number"
              min={30}
              value={form.licenseValidDays}
              onChange={(e) => setForm({ ...form, licenseValidDays: e.target.value })}
            />
            <p className="md:col-span-2 text-xs text-hope-secondary">
              {DEPLOYMENT_HELP[form.deploymentType]}
            </p>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create & issue license'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </PageCard>
      )}

      {loading ? (
        <PageSkeleton />
      ) : (
        <PageCard noPadding>
          <Table>
            <THead>
              <TR>
                <TH>Company</TH>
                <TH>Status</TH>
                <TH>Deployment</TH>
                <TH>Commercial</TH>
                <TH>Catalog</TH>
                <TH>License until</TH>
                <TH className="text-right" />
              </TR>
            </THead>
            <TBody>
              {tenants.map((t) => {
                const lic = licenseFor(t.id);
                const catalog = catalogFor(t.id);
                return (
                  <Fragment key={t.id}>
                  <TR>
                    <TD>
                      <p className="font-semibold text-hope-dark">{t.name}</p>
                      {t.legalName && (
                        <p className="text-xs text-hope-secondary">{t.legalName}</p>
                      )}
                    </TD>
                    <TD>
                      <StatusChip status={t.status} />
                    </TD>
                    <TD>{t.deploymentType}</TD>
                    <TD>{lic?.commercialModel ?? '—'}</TD>
                    <TD>
                      {catalog ? (
                        <span className="text-xs text-hope-secondary">
                          {catalog.categories} cat · {catalog.productTypes} types · {catalog.variants} variants
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD>
                      {lic ? new Date(lic.validUntil).toLocaleDateString() : '—'}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => showTenantCatalog(t.id)}>
                          {expandedTenantId === t.id ? 'Hide' : 'Catalog'}
                        </Button>
                        {lic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const next = new Date(lic.validUntil);
                              next.setFullYear(next.getFullYear() + 1);
                              await api.renewPlatformLicense(
                                t.id,
                                next.toISOString().slice(0, 10),
                              );
                              setMessage(`License renewed for ${t.name}`);
                              load();
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Renew
                          </Button>
                        )}
                        <Link href={`/domains?tenantId=${t.id}`}>
                          <Button variant="ghost" size="sm">
                            Domains
                          </Button>
                        </Link>
                      </div>
                    </TD>
                  </TR>
                  {expandedTenantId === t.id && tenantCatalog && (
                    <TR key={`${t.id}-catalog`}>
                      <TD colSpan={7}>
                        <div className="rounded-lg bg-slate-50 p-4 text-sm">
                          <p className="mb-2 font-semibold text-hope-dark">
                            {tenantCatalog.tenantName} — {tenantCatalog.totals.categories} categories ·{' '}
                            {tenantCatalog.totals.productTypes} product types ·{' '}
                            {tenantCatalog.totals.variants} variants
                          </p>
                          {tenantCatalog.categories.map((category) => (
                            <div key={category.id} className="mb-3">
                              <p className="font-medium">
                                {category.name} → {category.productTypeCount} product types →{' '}
                                {category.variantCount} variants
                              </p>
                              <ul className="mt-1 pl-4 text-hope-secondary">
                                {category.productTypes.map((pt) => (
                                  <li key={pt.id}>
                                    {pt.name} ({pt.variantCount} variants)
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </TD>
                    </TR>
                  )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </PageCard>
      )}
    </>
  );
}
