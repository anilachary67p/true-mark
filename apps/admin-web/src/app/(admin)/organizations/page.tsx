'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import { VirtualizedTable } from '@/components/ui/VirtualizedTable';
import { StatCard } from '@/components/StatCard';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { api, errorMessage, isApiError, Tenant } from '@/lib/api';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { formatDate, toFiniteNumber } from '@/lib/format';
import { parseIntInRange } from '@/lib/validation';

const DEPLOYMENT_HELP: Record<string, string> = {
  SAAS: 'Multi-tenant SaaS — shared TrueMark platform',
  DEDICATED_CLOUD: 'Dedicated deployment — isolated stack in cloud',
  CUSTOMER_CLOUD: 'Dedicated deployment — customer cloud account',
  ON_PREM: 'Dedicated deployment — customer datacenter',
  HYBRID: 'Dedicated deployment — on-prem core + optional cloud AI',
};

const COMMERCIAL_MODELS = ['FULL_PRODUCT', 'MANAGED_SERVICE'];
const LICENSE_MIN_DAYS = 30;
const LICENSE_MAX_DAYS = 3650;
const NAME_MAX = 120;
const LEGAL_NAME_MAX = 200;

const EMPTY_FORM = {
  name: '',
  legalName: '',
  deploymentType: 'SAAS',
  commercialModel: 'FULL_PRODUCT',
  licenseValidDays: '365',
};

type FormErrors = Partial<Record<keyof typeof EMPTY_FORM, string>>;

type CatalogStats = Awaited<ReturnType<typeof api.getCatalogStats>>;

type OrganizationTableRow =
  | { kind: 'tenant'; tenant: Tenant }
  | {
      kind: 'catalog';
      tenantId: string;
      catalog: NonNullable<CatalogStats>;
    };

function buildOrganizationRows(
  tenants: Tenant[],
  expandedTenantId: string | null,
  tenantCatalog: CatalogStats | null,
): OrganizationTableRow[] {
  return tenants.flatMap((tenant) => {
    const rows: OrganizationTableRow[] = [{ kind: 'tenant', tenant }];
    if (expandedTenantId === tenant.id && tenantCatalog) {
      rows.push({ kind: 'catalog', tenantId: tenant.id, catalog: tenantCatalog });
    }
    return rows;
  });
}

function nextRenewalDate(validUntil: string): Date {
  const current = new Date(validUntil);
  const now = new Date();
  const base = Number.isNaN(current.getTime()) || current < now ? now : current;
  const next = new Date(base);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function validateForm(form: typeof EMPTY_FORM): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Company name is required';
  else if (name.length > NAME_MAX) errors.name = `Company name must be at most ${NAME_MAX} characters`;
  if (form.legalName.trim().length > LEGAL_NAME_MAX) {
    errors.legalName = `Legal name must be at most ${LEGAL_NAME_MAX} characters`;
  }
  if (!DEPLOYMENT_HELP[form.deploymentType]) errors.deploymentType = 'Select a deployment model';
  if (!COMMERCIAL_MODELS.includes(form.commercialModel)) {
    errors.commercialModel = 'Select a commercial model';
  }
  if (parseIntInRange(form.licenseValidDays, LICENSE_MIN_DAYS, LICENSE_MAX_DAYS) === null) {
    errors.licenseValidDays = `Enter a whole number of days between ${LICENSE_MIN_DAYS} and ${LICENSE_MAX_DAYS}`;
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export default function OrganizationsPage() {
  const orgQuery = useAsyncData(async () => {
    const [tenantList, licenseList, overview] = await Promise.all([
      api.getTenants(),
      api.listPlatformLicenses().catch(() => []),
      api.getPlatformOverview().catch(() => null),
    ]);
    return {
      tenants: Array.isArray(tenantList) ? tenantList : [],
      licenses: Array.isArray(licenseList) ? licenseList : [],
      overview,
    };
  }, []);
  const tenants = orgQuery.data?.tenants ?? [];
  const licenses = orgQuery.data?.licenses ?? [];
  const platformOverview = orgQuery.data?.overview ?? null;

  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantCatalog, setTenantCatalog] = useState<CatalogStats | null>(null);
  const [catalogLoadingId, setCatalogLoadingId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const catalogRequestRef = useRef<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const createTenant = useAsyncAction((data: Parameters<typeof api.createTenant>[0]) =>
    api.createTenant(data),
  );
  const renewLicense = useAsyncAction((tenantId: string, validUntil: string) =>
    api.renewPlatformLicense(tenantId, validUntil),
  );

  function updateForm<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function closeCreate() {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
    createTenant.clearError();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createTenant.pending) return;
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setMessage('');
    const legalName = form.legalName.trim();
    const ok = await createTenant.run({
      name: form.name.trim(),
      legalName: legalName || undefined,
      deploymentType: form.deploymentType,
      commercialModel: form.commercialModel,
      licenseValidDays: parseIntInRange(form.licenseValidDays, LICENSE_MIN_DAYS, LICENSE_MAX_DAYS)!,
    });
    if (ok) {
      closeCreate();
      setMessage('Tenant created with signed license');
      orgQuery.reload();
    }
  }

  async function handleRenew(tenant: Tenant, validUntil: string) {
    if (renewLicense.pending) return;
    const next = nextRenewalDate(validUntil);
    const nextLabel = formatDate(next);
    if (!window.confirm(`Renew the license for ${tenant.name} until ${nextLabel}?`)) return;
    setMessage('');
    setRenewingId(tenant.id);
    const ok = await renewLicense.run(tenant.id, next.toISOString().slice(0, 10));
    setRenewingId(null);
    if (ok) {
      setMessage(`License renewed for ${tenant.name} until ${nextLabel}`);
      orgQuery.reload();
    }
  }

  function licenseFor(tenantId: string) {
    return licenses.find((l) => l.tenantId === tenantId);
  }

  function catalogFor(tenantId: string) {
    const overviewTenants = Array.isArray(platformOverview?.tenants) ? platformOverview.tenants : [];
    return overviewTenants.find((t) => t.id === tenantId)?.catalog;
  }

  async function showTenantCatalog(tenantId: string) {
    setCatalogError('');
    if (expandedTenantId === tenantId) {
      catalogRequestRef.current = null;
      setExpandedTenantId(null);
      setTenantCatalog(null);
      setCatalogLoadingId(null);
      return;
    }
    catalogRequestRef.current = tenantId;
    setExpandedTenantId(tenantId);
    setTenantCatalog(null);
    setCatalogLoadingId(tenantId);
    try {
      const stats = await api.getCatalogStats(tenantId);
      if (catalogRequestRef.current === tenantId) setTenantCatalog(stats);
    } catch (err) {
      if (catalogRequestRef.current !== tenantId) return;
      setExpandedTenantId(null);
      if (!isApiError(err, 401)) setCatalogError(errorMessage(err, 'Failed to load tenant catalog'));
    } finally {
      if (catalogRequestRef.current === tenantId) setCatalogLoadingId(null);
    }
  }

  const tableRows = useMemo(
    () => buildOrganizationRows(tenants, expandedTenantId, tenantCatalog),
    [tenants, expandedTenantId, tenantCatalog],
  );

  const totals = platformOverview?.totals;

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="Super Admin — onboard tenants, view platform statistics, and manage licenses"
        action={
          <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        }
      />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={renewLicense.error} severity="error" />
      <FeedbackAlert message={catalogError} severity="error" />

      {totals && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Tenants" value={toFiniteNumber(totals.tenants)} showChart={false} />
          <StatCard label="Categories" value={toFiniteNumber(totals.categories)} showChart={false} />
          <StatCard label="Product types" value={toFiniteNumber(totals.productTypes)} showChart={false} />
          <StatCard label="Variants" value={toFiniteNumber(totals.variants)} showChart={false} />
          <StatCard label="Tags" value={toFiniteNumber(totals.tags)} showChart={false} />
        </div>
      )}

      {showCreate && (
        <PageCard title="New Tenant">
          <FeedbackAlert message={createTenant.error} severity="error" />
          <form onSubmit={handleCreate} noValidate className="grid max-w-2xl gap-4 md:grid-cols-2">
            <div>
              <Input
                label="Company name"
                required
                maxLength={NAME_MAX}
                aria-invalid={!!formErrors.name}
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
              <FieldError message={formErrors.name} />
            </div>
            <div>
              <Input
                label="Legal name"
                maxLength={LEGAL_NAME_MAX}
                aria-invalid={!!formErrors.legalName}
                value={form.legalName}
                onChange={(e) => updateForm('legalName', e.target.value)}
              />
              <FieldError message={formErrors.legalName} />
            </div>
            <div>
              <Select
                label="Deployment model"
                value={form.deploymentType}
                onChange={(e) => updateForm('deploymentType', e.target.value)}
              >
                <option value="SAAS">Multi-tenant SaaS</option>
                <option value="DEDICATED_CLOUD">Dedicated Cloud</option>
                <option value="CUSTOMER_CLOUD">Customer Cloud</option>
                <option value="ON_PREM">On-Premises</option>
                <option value="HYBRID">Hybrid</option>
              </Select>
              <FieldError message={formErrors.deploymentType} />
            </div>
            <div>
              <Select
                label="Commercial model"
                value={form.commercialModel}
                onChange={(e) => updateForm('commercialModel', e.target.value)}
              >
                <option value="FULL_PRODUCT">Full Product (X + N)</option>
                <option value="MANAGED_SERVICE">Managed Service (N)</option>
              </Select>
              <FieldError message={formErrors.commercialModel} />
            </div>
            <div>
              <Input
                label="License validity (days)"
                type="number"
                inputMode="numeric"
                min={LICENSE_MIN_DAYS}
                max={LICENSE_MAX_DAYS}
                step={1}
                aria-invalid={!!formErrors.licenseValidDays}
                value={form.licenseValidDays}
                onChange={(e) => updateForm('licenseValidDays', e.target.value)}
              />
              <FieldError message={formErrors.licenseValidDays} />
            </div>
            <p className="md:col-span-2 text-xs text-hope-secondary">
              {DEPLOYMENT_HELP[form.deploymentType]}
            </p>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={createTenant.pending}>
                {createTenant.pending ? 'Creating…' : 'Create & issue license'}
              </Button>
              <Button variant="outline" onClick={closeCreate} disabled={createTenant.pending}>
                Cancel
              </Button>
            </div>
          </form>
        </PageCard>
      )}

      {orgQuery.error ? (
        <Alert variant="error">
          <div className="flex items-center justify-between gap-3">
            <span>{orgQuery.error}</span>
            <Button size="sm" variant="outline" onClick={orgQuery.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : orgQuery.loading && !orgQuery.data ? (
        <PageSkeleton />
      ) : (
        <PageCard noPadding>
          <VirtualizedTable
            columns={['Company', 'Status', 'Deployment', 'Commercial', 'Catalog', 'License until', '']}
            rows={tableRows}
            rowKey={(row) =>
              row.kind === 'tenant' ? row.tenant.id : `${row.tenantId}-catalog`
            }
            emptyMessage="No tenants yet. Create one to get started."
            columnClassNames={[undefined, undefined, undefined, undefined, undefined, undefined, 'text-right']}
            getRowHeight={(row) => (row.kind === 'catalog' ? 220 : 56)}
            maxHeight={560}
            renderRow={(row) => {
              if (row.kind === 'catalog') {
                const categories = Array.isArray(row.catalog.categories) ? row.catalog.categories : [];
                return (
                  <TD colSpan={7}>
                    <div className="rounded-lg bg-slate-50 p-4 text-sm">
                      <p className="mb-2 font-semibold text-hope-dark">
                        {row.catalog.tenantName} — {toFiniteNumber(row.catalog.totals?.categories)} categories ·{' '}
                        {toFiniteNumber(row.catalog.totals?.productTypes)} product types ·{' '}
                        {toFiniteNumber(row.catalog.totals?.variants)} variants
                      </p>
                      {categories.length === 0 && (
                        <p className="text-hope-secondary">No catalog entries yet.</p>
                      )}
                      {categories.map((category) => (
                        <div key={category.id} className="mb-3">
                          <p className="font-medium">
                            {category.name} → {category.productTypeCount} product types →{' '}
                            {category.variantCount} variants
                          </p>
                          <ul className="mt-1 pl-4 text-hope-secondary">
                            {(Array.isArray(category.productTypes) ? category.productTypes : []).map((pt) => (
                              <li key={pt.id}>
                                {pt.name} ({pt.variantCount} variants)
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </TD>
                );
              }

              const t = row.tenant;
              const lic = licenseFor(t.id);
              const catalog = catalogFor(t.id);

              return (
                <>
                  <TD>
                    <p className="font-semibold text-hope-dark">{t.name}</p>
                    {t.legalName && <p className="text-xs text-hope-secondary">{t.legalName}</p>}
                  </TD>
                  <TD>
                    <StatusChip status={t.status} />
                  </TD>
                  <TD>{t.deploymentType}</TD>
                  <TD>{lic?.commercialModel ?? '—'}</TD>
                  <TD>
                    {catalog ? (
                      <span className="text-xs text-hope-secondary">
                        {catalog.categories} cat · {catalog.productTypes} types · {catalog.variants}{' '}
                        variants
                      </span>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD>{lic ? formatDate(lic.validUntil) : '—'}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={catalogLoadingId === t.id}
                        onClick={() => showTenantCatalog(t.id)}
                      >
                        {catalogLoadingId === t.id
                          ? 'Loading…'
                          : expandedTenantId === t.id
                            ? 'Hide'
                            : 'Catalog'}
                      </Button>
                      {lic && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={renewLicense.pending}
                          onClick={() => handleRenew(t, lic.validUntil)}
                        >
                          <RefreshCw className={`h-4 w-4 ${renewingId === t.id ? 'animate-spin' : ''}`} />
                          {renewingId === t.id ? 'Renewing…' : 'Renew'}
                        </Button>
                      )}
                      <Link href={`/domains?tenantId=${encodeURIComponent(t.id)}`}>
                        <Button variant="ghost" size="sm">
                          Domains
                        </Button>
                      </Link>
                    </div>
                  </TD>
                </>
              );
            }}
          />
        </PageCard>
      )}
    </>
  );
}
