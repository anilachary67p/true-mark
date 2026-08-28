'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Bell, Mail, Save, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/lib/hooks';

const LICENSE_WARNING_DAYS = [30, 15, 7];
const LICENSE_GRACE_DAYS = 15;

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

const DEFAULT_CONFIG: NotificationConfig = {
  platformAlertEmail: 'admin@truemark.local',
  licenseExpiryEmail: true,
  licenseExpiryInApp: true,
  newTenantEmail: true,
  licenseRenewalEmail: true,
  securityDigestEmail: false,
  weeklyPlatformDigest: true,
};

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
  const id = label.toLowerCase().replace(/\s+/g, '-');
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
      }
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
      setMessage('Notification configuration saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notification"
        subtitle="Platform-wide email and in-app alerts for license lifecycle and operations"
      />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={error} severity="error" />

      <PageCard
        title="Delivery"
        action={
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
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
            onChange={(e) => setConfig((prev) => ({ ...prev, platformAlertEmail: e.target.value }))}
          />
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
            onChange={(licenseExpiryEmail) =>
              setConfig((prev) => ({ ...prev, licenseExpiryEmail }))
            }
          />
          <ToggleRow
            label="License expiry — in-app banner"
            description="Show warning banners in the tenant admin UI during warning and grace periods."
            checked={config.licenseExpiryInApp}
            onChange={(licenseExpiryInApp) =>
              setConfig((prev) => ({ ...prev, licenseExpiryInApp }))
            }
          />
          <ToggleRow
            label="License renewal confirmation"
            description="Notify the platform team when a Super Admin renews or issues a license."
            checked={config.licenseRenewalEmail}
            onChange={(licenseRenewalEmail) =>
              setConfig((prev) => ({ ...prev, licenseRenewalEmail }))
            }
          />
        </div>
      </PageCard>

      <PageCard title="Organization events">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label="New tenant onboarded"
            description="Email the platform team when a new organization is created."
            checked={config.newTenantEmail}
            onChange={(newTenantEmail) => setConfig((prev) => ({ ...prev, newTenantEmail }))}
          />
          <ToggleRow
            label="Weekly platform digest"
            description="Summary of verifications, active tenants, and licenses expiring within 30 days."
            checked={config.weeklyPlatformDigest}
            onChange={(weeklyPlatformDigest) =>
              setConfig((prev) => ({ ...prev, weeklyPlatformDigest }))
            }
          />
        </div>
      </PageCard>

      <PageCard title="Security">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label="Cross-tenant fraud digest"
            description="Daily email when elevated fraud signals are detected across multiple tenants."
            checked={config.securityDigestEmail}
            onChange={(securityDigestEmail) =>
              setConfig((prev) => ({ ...prev, securityDigestEmail }))
            }
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
