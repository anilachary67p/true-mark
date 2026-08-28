'use client';

import { PlatformSettings } from '@/components/PlatformSettings';
import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useEffect, useState } from 'react';
import { api, getToken, Tenant } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useSession, useTenantId } from '@/lib/hooks';
import { isPlatformAdminRole } from '@/lib/roleAccess';
import { Building2, Globe, Save, Shield } from 'lucide-react';

function TenantSettingsPage() {
  const router = useRouter();
  const tenantId = useTenantId();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [fraudConfig, setFraudConfig] = useState({
    highScanCount: 50,
    highScanWindowMinutes: 30,
    maxTravelSpeedKmh: 900,
    impossibleTravelMinutes: 60,
  });
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  const load = async (tid: string) => {
    const [t, fraud] = await Promise.all([api.getTenant(tid), api.getFraudConfig(tid)]);
    setTenant(t);
    setOrgName(t.name ?? '');
    setLegalName(t.legalName ?? '');
    setDisplayName(t.profile?.companyDisplayName ?? '');
    setContactEmail(t.profile?.contactEmail ?? '');
    setCountry(t.profile?.country ?? '');
    setAddress(t.profile?.address ?? '');
    if (fraud) setFraudConfig(fraud);
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) {
      load(tenantId).catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load settings'),
      );
    }
  }, [router, tenantId]);

  async function saveSection(section: string, action: () => Promise<unknown>) {
    if (!tenantId) return;
    setSaving(section);
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(`${section} saved successfully`);
      await load(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${section}`);
    } finally {
      setSaving('');
    }
  }

  if (!tenantId || !tenant) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage organization, branding, and fraud detection" />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={error} severity="error" />

      <PageCard
        title="Organization"
        action={
          <Button
            size="sm"
            disabled={saving === 'Organization'}
            onClick={() =>
              saveSection('Organization', () =>
                api.updateTenant(tenantId, { name: orgName, legalName }),
              )
            }
          >
            <Save className="h-4 w-4" />
            {saving === 'Organization' ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <Input
            label="Legal name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-hope-secondary">
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
            Status: <Badge status={tenant.status} />
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-1.5">
            Deployment: {tenant.deploymentType}
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-1.5">Config v{tenant.configVersion}</span>
        </div>
      </PageCard>

      <PageCard
        title="Consumer branding"
        action={
          <Button
            size="sm"
            disabled={saving === 'Branding'}
            onClick={() =>
              saveSection('Branding', () =>
                api.updateTenantProfile(tenantId, {
                  companyDisplayName: displayName,
                  contactEmail,
                  country,
                  address,
                }),
              )
            }
          >
            <Globe className="h-4 w-4" />
            {saving === 'Branding' ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <p className="mb-4 text-sm text-hope-secondary">
          Shown on the consumer verification page (e.g. company name above product details).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Company display name"
            placeholder="PureGlow"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Contact email"
            type="email"
            placeholder="contact@company.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Input
            label="Country"
            placeholder="IN"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Address"
            rows={3}
            placeholder="Street, city, postal code"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </PageCard>

      <PageCard
        title="Fraud detection thresholds"
        action={
          <Button
            size="sm"
            disabled={saving === 'Fraud settings'}
            onClick={() =>
              saveSection('Fraud settings', () => api.updateFraudConfig(tenantId, fraudConfig))
            }
          >
            <Shield className="h-4 w-4" />
            {saving === 'Fraud settings' ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <p className="mb-4 text-sm text-hope-secondary">
          Controls when scans are flagged as suspicious based on frequency and geography.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="High scan count"
            type="number"
            min={1}
            value={fraudConfig.highScanCount}
            onChange={(e) =>
              setFraudConfig((prev) => ({ ...prev, highScanCount: Number(e.target.value) }))
            }
          />
          <Input
            label="Scan window (minutes)"
            type="number"
            min={1}
            value={fraudConfig.highScanWindowMinutes}
            onChange={(e) =>
              setFraudConfig((prev) => ({
                ...prev,
                highScanWindowMinutes: Number(e.target.value),
              }))
            }
          />
          <Input
            label="Max travel speed (km/h)"
            type="number"
            min={1}
            value={fraudConfig.maxTravelSpeedKmh}
            onChange={(e) =>
              setFraudConfig((prev) => ({ ...prev, maxTravelSpeedKmh: Number(e.target.value) }))
            }
          />
          <Input
            label="Impossible travel window (minutes)"
            type="number"
            min={1}
            value={fraudConfig.impossibleTravelMinutes}
            onChange={(e) =>
              setFraudConfig((prev) => ({
                ...prev,
                impossibleTravelMinutes: Number(e.target.value),
              }))
            }
          />
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

  if (!ready) return null;

  if (isPlatformAdminRole(roles)) {
    return <PlatformSettings />;
  }

  return <TenantSettingsPage />;
}
