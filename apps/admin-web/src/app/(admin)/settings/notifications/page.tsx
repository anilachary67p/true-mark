'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Bell, Mail, Save, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/lib/hooks';
import { useAsyncAction } from '@/lib/useAsync';
import { isEmail } from '@/lib/validation';

const LICENSE_WARNING_DAYS = [30, 15, 7];
const LICENSE_GRACE_DAYS = 15;
const EMAIL_MAX = 254;

const STORAGE_KEY = 'truemark_platform_notification_config';

type NotificationConfig = {
  platformAlertEmail: string;
  licenseExpiryEmail: boolean;
  licenseExpiryInApp: boolean;
  newTenantEmail: boolean;
  licenseRenewalEmail: boolean;
  securityDigestEmail: boolean;
  weeklyPlatformDigest: boolean;
};

type ToggleKey = Exclude<keyof NotificationConfig, 'platformAlertEmail'>;

const DEFAULT_CONFIG: NotificationConfig = {
  platformAlertEmail: 'admin@truemark.local',
  licenseExpiryEmail: true,
  licenseExpiryInApp: true,
  newTenantEmail: true,
  licenseRenewalEmail: true,
  securityDigestEmail: false,
  weeklyPlatformDigest: true,
};

const TOGGLE_KEYS: ToggleKey[] = [
  'licenseExpiryEmail',
  'licenseExpiryInApp',
  'newTenantEmail',
  'licenseRenewalEmail',
  'securityDigestEmail',
  'weeklyPlatformDigest',
];

const EMAIL_TOGGLES: ToggleKey[] = [
  'licenseExpiryEmail',
  'newTenantEmail',
  'licenseRenewalEmail',
  'securityDigestEmail',
  'weeklyPlatformDigest',
];

const CRITICAL_TOGGLES: Partial<Record<ToggleKey, string>> = {
  licenseExpiryEmail:
    'Disable license expiry emails? Tenant admins and the platform team will no longer be emailed before licenses expire.',
  licenseExpiryInApp:
    'Disable in-app license banners? Tenants will not see warnings before access is blocked.',
};

function readStoredConfig(): NotificationConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;
  const p = parsed as Record<string, unknown>;
  const next = { ...DEFAULT_CONFIG };
  if (typeof p.platformAlertEmail === 'string') next.platformAlertEmail = p.platformAlertEmail;
  for (const key of TOGGLE_KEYS) {
    if (typeof p[key] === 'boolean') next[key] = p[key] as boolean;
  }
  return next;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-hope-primary/30"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-hope-primary focus:ring-hope-primary/20"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-hope-dark">{label}</span>
        <span className="mt-0.5 block text-sm text-hope-secondary">{description}</span>
      </span>
    </label>
  );
}

export default function NotificationsConfigurationPage() {
  useAuthGuard();
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG);
  const [message, setMessage] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      setConfig(readStoredConfig());
    } catch {
      setLoadWarning('Saved notification settings could not be read; defaults are shown.');
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

  const saveAction = useAsyncAction(async (next: NotificationConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error('Unable to save settings in this browser (storage unavailable or full).');
    }
  });

  const email = config.platformAlertEmail.trim();
  const needsEmail = EMAIL_TOGGLES.some((key) => config[key]);
  const emailError = !email
    ? needsEmail
      ? 'An alert email is required while email notifications are enabled.'
      : undefined
    : email.length > EMAIL_MAX || !isEmail(email)
      ? 'Enter a valid email address.'
      : undefined;

  function setToggle(key: ToggleKey, value: boolean) {
    const warning = CRITICAL_TOGGLES[key];
    if (!value && warning && !window.confirm(warning)) return;
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMessage('');
  }

  async function handleSave() {
    if (emailError) return;
    setMessage('');
    const next = { ...config, platformAlertEmail: email };
    if (await saveAction.run(next)) {
      setConfig(next);
      setDirty(false);
      setMessage('Notification configuration saved');
    }
  }

  return (
    <>
      <PageHeader
        title="Notification"
        subtitle="Platform-wide email and in-app alerts for license lifecycle and operations"
      />
      <FeedbackAlert message={loadWarning} severity="info" />
      <FeedbackAlert message={message} />
      <FeedbackAlert
        message={saveAction.error ? `${saveAction.error} Your changes are still in the form.` : ''}
        severity="error"
      />

      <PageCard
        title="Delivery"
        action={
          <div className="flex items-center gap-2">
            {dirty && !saveAction.pending && (
              <span className="text-xs text-hope-muted">Unsaved changes</span>
            )}
            <Button size="sm" disabled={saveAction.pending || !!emailError || !dirty} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saveAction.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-hope-secondary">
          Primary recipient for platform-level alerts. Tenant admins receive their own license
          warnings on their organization contact email.
        </p>
        <div className="max-w-xl">
          <Input
            label="Platform alert email"
            type="email"
            placeholder="admin@truemark.local"
            value={config.platformAlertEmail}
            maxLength={EMAIL_MAX}
            onChange={(e) => {
              const platformAlertEmail = e.target.value;
              setConfig((prev) => ({ ...prev, platformAlertEmail }));
              setDirty(true);
              setMessage('');
            }}
            aria-invalid={!!emailError}
          />
          {emailError && <p className="mt-1 text-xs text-hope-danger">{emailError}</p>}
        </div>
      </PageCard>

      <PageCard title="License lifecycle">
        <p className="mb-4 text-sm text-hope-secondary">
          Warnings are sent at {LICENSE_WARNING_DAYS.join(', ')} days before expiry. After expiry,
          tenants enter a {LICENSE_GRACE_DAYS}-day grace period before access is blocked.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label="License expiry — email"
            description="Email tenant admins and the platform alert address when a license enters a warning or grace state."
            checked={config.licenseExpiryEmail}
            onChange={(v) => setToggle('licenseExpiryEmail', v)}
          />
          <ToggleRow
            label="License expiry — in-app banner"
            description="Show warning banners in the tenant admin UI during warning and grace periods."
            checked={config.licenseExpiryInApp}
            onChange={(v) => setToggle('licenseExpiryInApp', v)}
          />
          <ToggleRow
            label="License renewal confirmation"
            description="Notify the platform team when a Super Admin renews or issues a license."
            checked={config.licenseRenewalEmail}
            onChange={(v) => setToggle('licenseRenewalEmail', v)}
          />
        </div>
      </PageCard>

      <PageCard title="Organization events">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label="New tenant onboarded"
            description="Email the platform team when a new organization is created."
            checked={config.newTenantEmail}
            onChange={(v) => setToggle('newTenantEmail', v)}
          />
          <ToggleRow
            label="Weekly platform digest"
            description="Summary of verifications, active tenants, and licenses expiring within 30 days."
            checked={config.weeklyPlatformDigest}
            onChange={(v) => setToggle('weeklyPlatformDigest', v)}
          />
        </div>
      </PageCard>

      <PageCard title="Security">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label="Cross-tenant fraud digest"
            description="Daily email when elevated fraud signals are detected across multiple tenants."
            checked={config.securityDigestEmail}
            onChange={(v) => setToggle('securityDigestEmail', v)}
          />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-hope-secondary">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-hope-primary" />
          <p>
            SMTP delivery is configured via server environment variables. In-app banners use the
            license scheduler and do not require outbound email.
          </p>
        </div>
      </PageCard>

      <PageCard title="Channels">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
            <Mail className="mt-0.5 h-5 w-5 text-hope-primary" />
            <div>
              <p className="text-sm font-semibold text-hope-dark">Email</p>
              <p className="mt-1 text-sm text-hope-secondary">
                License warnings, onboarding, renewals, and optional digests.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
            <Bell className="mt-0.5 h-5 w-5 text-hope-primary" />
            <div>
              <p className="text-sm font-semibold text-hope-dark">In-app</p>
              <p className="mt-1 text-sm text-hope-secondary">
                License banners and renewal prompts inside the admin portal.
              </p>
            </div>
          </div>
        </div>
      </PageCard>
    </>
  );
}
