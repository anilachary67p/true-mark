'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Building2, Mail, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'truemark_platform_settings';

type PlatformSettingsConfig = {
  platformName: string;
  productOwnerEmail: string;
  productOwnerPhone: string;
  supportEmail: string;
  defaultLicenseDays: number;
};

const DEFAULT_CONFIG: PlatformSettingsConfig = {
  platformName: 'TrueMark',
  productOwnerEmail: 'admin@truemark.local',
  productOwnerPhone: '',
  supportEmail: 'support@truemark.local',
  defaultLicenseDays: 365,
};

export function PlatformSettings() {
  const [config, setConfig] = useState<PlatformSettingsConfig>(DEFAULT_CONFIG);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
    } catch {
      /* ignore invalid stored config */
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setMessage('Platform settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Platform identity, product owner contacts, and default license policy"
      />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={error} severity="error" />

      <PageCard
        title="Platform identity"
        action={
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Platform name"
            value={config.platformName}
            onChange={(e) => setConfig((prev) => ({ ...prev, platformName: e.target.value }))}
          />
          <Input
            label="Support email"
            type="email"
            value={config.supportEmail}
            onChange={(e) => setConfig((prev) => ({ ...prev, supportEmail: e.target.value }))}
          />
        </div>
      </PageCard>

      <PageCard title="Product owner">
        <p className="mb-4 text-sm text-hope-secondary">
          Shown on signed license files and used for renewal contact during grace periods.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Product owner email"
            type="email"
            value={config.productOwnerEmail}
            onChange={(e) => setConfig((prev) => ({ ...prev, productOwnerEmail: e.target.value }))}
          />
          <Input
            label="Product owner phone"
            value={config.productOwnerPhone}
            onChange={(e) => setConfig((prev) => ({ ...prev, productOwnerPhone: e.target.value }))}
          />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-hope-secondary">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-hope-primary" />
          <p>
            Production values are typically set via{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">PRODUCT_OWNER_EMAIL</code> and{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">PRODUCT_OWNER_PHONE</code>{' '}
            environment variables.
          </p>
        </div>
      </PageCard>

      <PageCard title="License defaults">
        <div className="max-w-sm">
          <Input
            label="Default license validity (days)"
            type="number"
            min={30}
            value={config.defaultLicenseDays}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, defaultLicenseDays: Number(e.target.value) }))
            }
          />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
          <Building2 className="mt-0.5 h-5 w-5 text-hope-primary" />
          <p className="text-sm text-hope-secondary">
            Applied when onboarding a new organization from the Organizations page unless overridden
            during creation.
          </p>
        </div>
      </PageCard>
    </>
  );
}
