'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Database, KeyRound, Save, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/lib/hooks';

const STORAGE_KEY = 'truemark_platform_config';

type PlatformConfig = {
  licenseValidationHours: number;
  licenseGraceDays: number;
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  sessionTimeoutMinutes: number;
  auditRetentionDays: number;
  aiDefaultMode: 'AI_OPTIONAL' | 'AI_DISABLED' | 'AI_REQUIRED';
};

const DEFAULT_CONFIG: PlatformConfig = {
  licenseValidationHours: 24,
  licenseGraceDays: 15,
  smtpHost: '',
  smtpPort: 587,
  smtpFrom: 'noreply@truemark.local',
  sessionTimeoutMinutes: 480,
  auditRetentionDays: 365,
  aiDefaultMode: 'AI_OPTIONAL',
};

export default function PlatformConfigPage() {
  useAuthGuard();
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
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
      setMessage('Platform configuration saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Config"
        subtitle="System runtime, licensing scheduler, email delivery, and security defaults"
      />
      <FeedbackAlert message={message} />
      <FeedbackAlert message={error} severity="error" />

      <PageCard
        title="License scheduler"
        action={
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Validation interval (hours)"
            type="number"
            min={1}
            value={config.licenseValidationHours}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, licenseValidationHours: Number(e.target.value) }))
            }
          />
          <Input
            label="Grace period (days)"
            type="number"
            min={1}
            value={config.licenseGraceDays}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, licenseGraceDays: Number(e.target.value) }))
            }
          />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-hope-secondary">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-hope-primary" />
          <p>
            The API validates licenses on startup and on this interval. Signing keys remain
            server-side only and are not editable from the admin UI.
          </p>
        </div>
      </PageCard>

      <PageCard title="Email delivery">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="SMTP host"
            placeholder="smtp.example.com"
            value={config.smtpHost}
            onChange={(e) => setConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
          />
          <Input
            label="SMTP port"
            type="number"
            min={1}
            value={config.smtpPort}
            onChange={(e) => setConfig((prev) => ({ ...prev, smtpPort: Number(e.target.value) }))}
          />
          <Input
            label="From address"
            type="email"
            value={config.smtpFrom}
            onChange={(e) => setConfig((prev) => ({ ...prev, smtpFrom: e.target.value }))}
          />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-hope-secondary">
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-hope-primary" />
          <p>
            Outbound email for notifications uses these settings when SMTP is enabled in the API.
          </p>
        </div>
      </PageCard>

      <PageCard title="Security & retention">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Session timeout (minutes)"
            type="number"
            min={15}
            value={config.sessionTimeoutMinutes}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value) }))
            }
          />
          <Input
            label="Audit log retention (days)"
            type="number"
            min={30}
            value={config.auditRetentionDays}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, auditRetentionDays: Number(e.target.value) }))
            }
          />
          <Select
            label="Default AI mode for new tenants"
            value={config.aiDefaultMode}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                aiDefaultMode: e.target.value as PlatformConfig['aiDefaultMode'],
              }))
            }
          >
            <option value="AI_OPTIONAL">AI optional</option>
            <option value="AI_DISABLED">AI disabled</option>
            <option value="AI_REQUIRED">AI required</option>
          </Select>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-hope-secondary">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-hope-primary" />
          <p>
            Tenant-specific overrides remain available under each organization&apos;s tenant admin
            portal.
          </p>
        </div>
      </PageCard>
    </>
  );
}
