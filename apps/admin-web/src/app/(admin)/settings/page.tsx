'use client';

import { PlatformSettings } from '@/components/PlatformSettings';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useSession, useTenantId } from '@/lib/hooks';
import { isPlatformAdminRole } from '@/lib/roleAccess';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { isEmail, parseIntInRange } from '@/lib/validation';
import { Building2, Globe, Save, Shield } from 'lucide-react';

type Section = 'Organization' | 'Branding' | 'Fraud settings';
type FraudForm = {
  highScanCount: string;
  highScanWindowMinutes: string;
  maxTravelSpeedKmh: string;
  impossibleTravelMinutes: string;
};

const DEFAULT_FRAUD: FraudForm = {
  highScanCount: '50',
  highScanWindowMinutes: '30',
  maxTravelSpeedKmh: '900',
  impossibleTravelMinutes: '60',
};

const LIMITS = {
  orgName: 120,
  legalName: 200,
  displayName: 120,
  contactEmail: 254,
  country: 80,
  address: 500,
};

function numberInRange(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-hope-danger">{message}</p> : null;
}

function TenantSettingsPage() {
  const tenantId = useTenantId();
  const [fraudForm, setFraudForm] = useState<FraudForm>(DEFAULT_FRAUD);
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<Section | ''>('');
  const [dirty, setDirty] = useState<Record<Section, boolean>>({
    Organization: false,
    Branding: false,
    'Fraud settings': false,
  });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [tenant, fraud] = await Promise.all([api.getTenant(tenantId), api.getFraudConfig(tenantId)]);
      return { tenant, fraud };
    },
    [tenantId],
    { enabled: !!tenantId },
  );
  const tenant = data?.tenant ?? null;

  useEffect(() => {
    if (!data) return;
    const { tenant: t, fraud } = data;
    const d = dirtyRef.current;
    if (t && !d.Organization) {
      setOrgName(t.name ?? '');
      setLegalName(t.legalName ?? '');
    }
    if (t && !d.Branding) {
      setDisplayName(t.profile?.companyDisplayName ?? '');
      setContactEmail(t.profile?.contactEmail ?? '');
      setCountry(t.profile?.country ?? '');
      setAddress(t.profile?.address ?? '');
    }
    if (fraud && !d['Fraud settings']) {
      setFraudForm({
        highScanCount: String(fraud.highScanCount ?? DEFAULT_FRAUD.highScanCount),
        highScanWindowMinutes: String(fraud.highScanWindowMinutes ?? DEFAULT_FRAUD.highScanWindowMinutes),
        maxTravelSpeedKmh: String(fraud.maxTravelSpeedKmh ?? DEFAULT_FRAUD.maxTravelSpeedKmh),
        impossibleTravelMinutes: String(fraud.impossibleTravelMinutes ?? DEFAULT_FRAUD.impossibleTravelMinutes),
      });
    }
  }, [data]);

  const saveAction = useAsyncAction((action: () => Promise<unknown>) => action());

  function markDirty(section: Section) {
    setMessage('');
    setDirty((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
  }

  const orgErrors = {
    orgName: !orgName.trim()
      ? 'Organization name is required.'
      : orgName.trim().length > LIMITS.orgName
        ? `Must be at most ${LIMITS.orgName} characters.`
        : undefined,
    legalName:
      legalName.trim().length > LIMITS.legalName ? `Must be at most ${LIMITS.legalName} characters.` : undefined,
  };
  const brandingErrors = {
    displayName:
      displayName.trim().length > LIMITS.displayName
        ? `Must be at most ${LIMITS.displayName} characters.`
        : undefined,
    contactEmail: !contactEmail.trim()
      ? undefined
      : contactEmail.trim().length > LIMITS.contactEmail
        ? `Must be at most ${LIMITS.contactEmail} characters.`
        : !isEmail(contactEmail)
          ? 'Enter a valid email address.'
          : undefined,
    country: country.trim().length > LIMITS.country ? `Must be at most ${LIMITS.country} characters.` : undefined,
    address: address.trim().length > LIMITS.address ? `Must be at most ${LIMITS.address} characters.` : undefined,
  };
  const fraudValues = {
    highScanCount: parseIntInRange(fraudForm.highScanCount, 1, 100_000),
    highScanWindowMinutes: parseIntInRange(fraudForm.highScanWindowMinutes, 1, 43_200),
    maxTravelSpeedKmh: numberInRange(fraudForm.maxTravelSpeedKmh, 1, 5_000),
    impossibleTravelMinutes: parseIntInRange(fraudForm.impossibleTravelMinutes, 1, 43_200),
  };
  const fraudErrors = {
    highScanCount: fraudValues.highScanCount === null ? 'Whole number between 1 and 100,000.' : undefined,
    highScanWindowMinutes:
      fraudValues.highScanWindowMinutes === null ? 'Whole number between 1 and 43,200.' : undefined,
    maxTravelSpeedKmh: fraudValues.maxTravelSpeedKmh === null ? 'Number between 1 and 5,000.' : undefined,
    impossibleTravelMinutes:
      fraudValues.impossibleTravelMinutes === null ? 'Whole number between 1 and 43,200.' : undefined,
  };
  const hasErrors = (errors: Record<string, string | undefined>) => Object.values(errors).some(Boolean);

  async function saveSection(section: Section, action: () => Promise<unknown>) {
    if (!tenantId || saveAction.pending) return;
    setSaving(section);
    setMessage('');
    const ok = await saveAction.run(action);
    setSaving('');
    if (ok) {
      setDirty((prev) => ({ ...prev, [section]: false }));
      dirtyRef.current = { ...dirtyRef.current, [section]: false };
      setMessage(`${section} saved successfully`);
      reload();
    }
  }

  function saveOrganization() {
    if (hasErrors(orgErrors)) return;
    const name = orgName.trim();
    const legal = legalName.trim();
    setOrgName(name);
    setLegalName(legal);
    saveSection('Organization', () => api.updateTenant(tenantId, { name, legalName: legal }));
  }

  function saveBranding() {
    if (hasErrors(brandingErrors)) return;
    const email = contactEmail.trim();
    saveSection('Branding', () =>
      api.updateTenantProfile(tenantId, {
        companyDisplayName: displayName.trim(),
        country: country.trim(),
        address: address.trim(),
        ...(email ? { contactEmail: email } : {}),
      }),
    );
  }

  function saveFraud() {
    const v = fraudValues;
    if (
      v.highScanCount === null ||
      v.highScanWindowMinutes === null ||
      v.maxTravelSpeedKmh === null ||
      v.impossibleTravelMinutes === null
    ) {
      return;
    }
    saveSection('Fraud settings', () =>
      api.updateFraudConfig(tenantId, {
        highScanCount: v.highScanCount!,
        highScanWindowMinutes: v.highScanWindowMinutes!,
        maxTravelSpeedKmh: v.maxTravelSpeedKmh!,
        impossibleTravelMinutes: v.impossibleTravelMinutes!,
      }),
    );
  }

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  if (!tenant) {
    return error ? (
      <>
        <PageHeader title="Settings" subtitle="Manage organization, branding, and fraud detection" />
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
              Retry
            </Button>
          </div>
        </Alert>
      </>
    ) : (
      <PageSkeleton />
    );
  }

  const unsavedNote = (section: Section) =>
    dirty[section] && saving !== section ? (
      <span className="text-xs text-hope-muted">Unsaved changes</span>
    ) : null;

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage organization, branding, and fraud detection" />
      <FeedbackAlert message={message} />
      <FeedbackAlert
        message={saveAction.error ? `${saveAction.error} Your changes have not been saved.` : ''}
        severity="error"
      />
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

      <PageCard
        title="Organization"
        action={
          <div className="flex items-center gap-3">
            {unsavedNote('Organization')}
            <Button
              size="sm"
              disabled={saveAction.pending || hasErrors(orgErrors) || !dirty.Organization}
              onClick={saveOrganization}
            >
              <Save className="h-4 w-4" />
              {saving === 'Organization' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input
              label="Organization name"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                markDirty('Organization');
              }}
              aria-invalid={!!orgErrors.orgName}
            />
            <FieldError message={orgErrors.orgName} />
          </div>
          <div>
            <Input
              label="Legal name"
              value={legalName}
              onChange={(e) => {
                setLegalName(e.target.value);
                markDirty('Organization');
              }}
              aria-invalid={!!orgErrors.legalName}
            />
            <FieldError message={orgErrors.legalName} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-hope-secondary">
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
            Status: <Badge status={tenant.status} />
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-1.5">
            Deployment: {tenant.deploymentType || '—'}
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-1.5">Config v{tenant.configVersion ?? '—'}</span>
        </div>
      </PageCard>

      <PageCard
        title="Consumer branding"
        action={
          <div className="flex items-center gap-3">
            {unsavedNote('Branding')}
            <Button
              size="sm"
              disabled={saveAction.pending || hasErrors(brandingErrors) || !dirty.Branding}
              onClick={saveBranding}
            >
              <Globe className="h-4 w-4" />
              {saving === 'Branding' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-hope-secondary">
          Shown on the consumer verification page (e.g. company name above product details).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input
              label="Company display name"
              placeholder="PureGlow"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                markDirty('Branding');
              }}
              aria-invalid={!!brandingErrors.displayName}
            />
            <FieldError message={brandingErrors.displayName} />
          </div>
          <div>
            <Input
              label="Contact email"
              type="email"
              placeholder="contact@company.com"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                markDirty('Branding');
              }}
              aria-invalid={!!brandingErrors.contactEmail}
            />
            <FieldError message={brandingErrors.contactEmail} />
          </div>
          <div>
            <Input
              label="Country"
              placeholder="IN"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                markDirty('Branding');
              }}
              aria-invalid={!!brandingErrors.country}
            />
            <FieldError message={brandingErrors.country} />
          </div>
        </div>
        <div className="mt-4">
          <Textarea
            label="Address"
            rows={3}
            placeholder="Street, city, postal code"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              markDirty('Branding');
            }}
            aria-invalid={!!brandingErrors.address}
          />
          <FieldError message={brandingErrors.address} />
        </div>
      </PageCard>

      <PageCard
        title="Fraud detection thresholds"
        action={
          <div className="flex items-center gap-3">
            {unsavedNote('Fraud settings')}
            <Button
              size="sm"
              disabled={saveAction.pending || hasErrors(fraudErrors) || !dirty['Fraud settings']}
              onClick={saveFraud}
            >
              <Shield className="h-4 w-4" />
              {saving === 'Fraud settings' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-hope-secondary">
          Controls when scans are flagged as suspicious based on frequency and geography.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ['highScanCount', 'High scan count', 100_000],
              ['highScanWindowMinutes', 'Scan window (minutes)', 43_200],
              ['maxTravelSpeedKmh', 'Max travel speed (km/h)', 5_000],
              ['impossibleTravelMinutes', 'Impossible travel window (minutes)', 43_200],
            ] as const
          ).map(([key, label, max]) => (
            <div key={key}>
              <Input
                label={label}
                type="number"
                min={1}
                max={max}
                step={key === 'maxTravelSpeedKmh' ? 'any' : 1}
                value={fraudForm[key]}
                onChange={(e) => {
                  const value = e.target.value;
                  setFraudForm((prev) => ({ ...prev, [key]: value }));
                  markDirty('Fraud settings');
                }}
                aria-invalid={!!fraudErrors[key]}
              />
              <FieldError message={fraudErrors[key]} />
            </div>
          ))}
        </div>
      </PageCard>

      <PageCard title="Account">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <Building2 className="mt-0.5 h-5 w-5 text-hope-primary" />
          <div>
            <p className="text-sm font-semibold text-hope-dark">Tenant ID</p>
            <p className="mt-1 font-mono text-xs text-hope-secondary">{tenantId}</p>
            <p className="mt-2 text-xs text-hope-muted">
              Use Domains to manage verification URLs. Use AI Detection for AI mode and reference
              images.
            </p>
          </div>
        </div>
      </PageCard>
    </>
  );
}

export default function SettingsPage() {
  useAuthGuard();
  const { roles, ready } = useSession();

  if (!ready) return <PageSkeleton />;

  if (isPlatformAdminRole(roles)) {
    return <PlatformSettings />;
  }

  return <TenantSettingsPage />;
}
