'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Building2, Mail, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAsyncAction } from '@/lib/useAsync';
import { isEmail, parseIntInRange } from '@/lib/validation';

const STORAGE_KEY = 'truemark_platform_settings';

const PLATFORM_NAME_MAX = 120;
const EMAIL_MAX = 254;
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;
const LICENSE_DAYS_MIN = 30;
const LICENSE_DAYS_MAX = 3650;

type PlatformSettingsConfig = {
  platformName: string;
  productOwnerEmail: string;
  productOwnerPhone: string;
  supportEmail: string;
  defaultLicenseDays: number;
};

type SettingsForm = Omit<PlatformSettingsConfig, 'defaultLicenseDays'> & { defaultLicenseDays: string };

const DEFAULT_CONFIG: PlatformSettingsConfig = {
  platformName: 'TrueMark',
  productOwnerEmail: 'admin@truemark.local',
  productOwnerPhone: '',
  supportEmail: 'support@truemark.local',
  defaultLicenseDays: 365,
};

function toForm(config: PlatformSettingsConfig): SettingsForm {
  return { ...config, defaultLicenseDays: String(config.defaultLicenseDays) };
}

function readStoredConfig(): PlatformSettingsConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;
  const p = parsed as Record<string, unknown>;
  const next = { ...DEFAULT_CONFIG };
  if (typeof p.platformName === 'string') next.platformName = p.platformName;
  if (typeof p.productOwnerEmail === 'string') next.productOwnerEmail = p.productOwnerEmail;
  if (typeof p.productOwnerPhone === 'string') next.productOwnerPhone = p.productOwnerPhone;
  if (typeof p.supportEmail === 'string') next.supportEmail = p.supportEmail;
  if (
    typeof p.defaultLicenseDays === 'number' &&
    Number.isInteger(p.defaultLicenseDays) &&
    p.defaultLicenseDays >= LICENSE_DAYS_MIN &&
    p.defaultLicenseDays <= LICENSE_DAYS_MAX
  ) {
    next.defaultLicenseDays = p.defaultLicenseDays;
  }
  return next;
}

function emailError(value: string, required: boolean): string | undefined {
  const v = value.trim();
  if (!v) return required ? 'Email is required.' : undefined;
  if (v.length > EMAIL_MAX || !isEmail(v)) return 'Enter a valid email address.';
  return undefined;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-hope-danger">{message}</p> : null;
}

export function PlatformSettings() {
  const [form, setForm] = useState<SettingsForm>(() => toForm(DEFAULT_CONFIG));
  const [message, setMessage] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      setForm(toForm(readStoredConfig()));
    } catch {
      setLoadWarning('Saved settings could not be read; defaults are shown.');
    }
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const saveAction = useAsyncAction(async (config: PlatformSettingsConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      throw new Error('Unable to save settings in this browser (storage unavailable or full).');
    }
  });

  const platformName = form.platformName.trim();
  const phone = form.productOwnerPhone.trim();
  const licenseDays = parseIntInRange(form.defaultLicenseDays, LICENSE_DAYS_MIN, LICENSE_DAYS_MAX);
  const errors = {
    platformName: !platformName
      ? 'Platform name is required.'
      : platformName.length > PLATFORM_NAME_MAX
        ? `Must be at most ${PLATFORM_NAME_MAX} characters.`
        : undefined,
    supportEmail: emailError(form.supportEmail, true),
    productOwnerEmail: emailError(form.productOwnerEmail, true),
    productOwnerPhone:
      phone && !PHONE_PATTERN.test(phone) ? 'Use 6–20 digits; +, spaces, dashes and parentheses allowed.' : undefined,
    defaultLicenseDays:
      licenseDays === null
        ? `Whole number between ${LICENSE_DAYS_MIN} and ${LICENSE_DAYS_MAX.toLocaleString()}.`
        : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMessage('');
  }

  async function handleSave() {
    if (invalid || licenseDays === null) return;
    setMessage('');
    const next: PlatformSettingsConfig = {
      platformName,
      supportEmail: form.supportEmail.trim(),
      productOwnerEmail: form.productOwnerEmail.trim(),
      productOwnerPhone: phone,
      defaultLicenseDays: licenseDays,
    };
    if (await saveAction.run(next)) {
      setForm(toForm(next));
      setDirty(false);
      setMessage('Platform settings saved');
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Platform identity, product owner contacts, and default license policy"
      />
      <FeedbackAlert message={loadWarning} severity="info" />
      <FeedbackAlert message={message} />
      <FeedbackAlert
        message={saveAction.error ? `${saveAction.error} Your changes are still in the form.` : ''}
        severity="error"
      />

      <PageCard
        title="Platform identity"
        action={
          <div className="flex items-center gap-2">
            {dirty && !saveAction.pending && (
              <span className="text-xs text-hope-muted">Unsaved changes</span>
            )}
            <Button size="sm" disabled={saveAction.pending || invalid || !dirty} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saveAction.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input
              label="Platform name"
              value={form.platformName}
              onChange={(e) => update('platformName', e.target.value)}
              aria-invalid={!!errors.platformName}
            />
            <FieldError message={errors.platformName} />
          </div>
          <div>
            <Input
              label="Support email"
              type="email"
              maxLength={EMAIL_MAX}
              value={form.supportEmail}
              onChange={(e) => update('supportEmail', e.target.value)}
              aria-invalid={!!errors.supportEmail}
            />
            <FieldError message={errors.supportEmail} />
          </div>
        </div>
      </PageCard>

      <PageCard title="Product owner">
        <p className="mb-4 text-sm text-hope-secondary">
          Shown on signed license files and used for renewal contact during grace periods.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input
              label="Product owner email"
              type="email"
              maxLength={EMAIL_MAX}
              value={form.productOwnerEmail}
              onChange={(e) => update('productOwnerEmail', e.target.value)}
              aria-invalid={!!errors.productOwnerEmail}
            />
            <FieldError message={errors.productOwnerEmail} />
          </div>
          <div>
            <Input
              label="Product owner phone"
              type="tel"
              maxLength={20}
              value={form.productOwnerPhone}
              onChange={(e) => update('productOwnerPhone', e.target.value)}
              aria-invalid={!!errors.productOwnerPhone}
            />
            <FieldError message={errors.productOwnerPhone} />
          </div>
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
            min={LICENSE_DAYS_MIN}
            max={LICENSE_DAYS_MAX}
            step={1}
            value={form.defaultLicenseDays}
            onChange={(e) => update('defaultLicenseDays', e.target.value)}
            aria-invalid={!!errors.defaultLicenseDays}
          />
          <FieldError message={errors.defaultLicenseDays} />
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
