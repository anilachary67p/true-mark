'use client';

import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Database, KeyRound, Save, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/lib/hooks';
import { useAsyncAction } from '@/lib/useAsync';
import { isEmail, isHostname, parseIntInRange } from '@/lib/validation';

const STORAGE_KEY = 'truemark_platform_config';

const AI_MODES = ['AI_OPTIONAL', 'AI_DISABLED', 'AI_REQUIRED'] as const;

type PlatformConfig = {
  licenseValidationHours: number;
  licenseGraceDays: number;
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  sessionTimeoutMinutes: number;
  auditRetentionDays: number;
  aiDefaultMode: (typeof AI_MODES)[number];
};

type ConfigForm = {
  [K in keyof PlatformConfig]: PlatformConfig[K] extends number ? string : PlatformConfig[K];
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

const RANGES = {
  licenseValidationHours: [1, 168],
  licenseGraceDays: [1, 90],
  smtpPort: [1, 65_535],
  sessionTimeoutMinutes: [15, 1_440],
  auditRetentionDays: [30, 3_650],
} as const;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function toForm(config: PlatformConfig): ConfigForm {
  return {
    ...config,
    licenseValidationHours: String(config.licenseValidationHours),
    licenseGraceDays: String(config.licenseGraceDays),
    smtpPort: String(config.smtpPort),
    sessionTimeoutMinutes: String(config.sessionTimeoutMinutes),
    auditRetentionDays: String(config.auditRetentionDays),
  };
}

function readStoredConfig(): PlatformConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;
  const p = parsed as Record<string, unknown>;
  const next = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
    const [min, max] = RANGES[key];
    const n = p[key];
    if (typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max) next[key] = n;
  }
  if (typeof p.smtpHost === 'string') next.smtpHost = p.smtpHost;
  if (typeof p.smtpFrom === 'string') next.smtpFrom = p.smtpFrom;
  if (typeof p.aiDefaultMode === 'string' && (AI_MODES as readonly string[]).includes(p.aiDefaultMode)) {
    next.aiDefaultMode = p.aiDefaultMode as PlatformConfig['aiDefaultMode'];
  }
  return next;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-hope-danger">{message}</p> : null;
}

export default function PlatformConfigPage() {
  useAuthGuard();
  const [form, setForm] = useState<ConfigForm>(() => toForm(DEFAULT_CONFIG));
  const [message, setMessage] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      setForm(toForm(readStoredConfig()));
    } catch {
      setLoadWarning('Saved configuration could not be read; defaults are shown.');
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

  const saveAction = useAsyncAction(async (config: PlatformConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      throw new Error('Unable to save configuration in this browser (storage unavailable or full).');
    }
  });

  const parsed = {
    licenseValidationHours: parseIntInRange(form.licenseValidationHours, ...RANGES.licenseValidationHours),
    licenseGraceDays: parseIntInRange(form.licenseGraceDays, ...RANGES.licenseGraceDays),
    smtpPort: parseIntInRange(form.smtpPort, ...RANGES.smtpPort),
    sessionTimeoutMinutes: parseIntInRange(form.sessionTimeoutMinutes, ...RANGES.sessionTimeoutMinutes),
    auditRetentionDays: parseIntInRange(form.auditRetentionDays, ...RANGES.auditRetentionDays),
  };
  const rangeMessage = (key: keyof typeof RANGES) =>
    parsed[key] === null
      ? `Whole number between ${RANGES[key][0].toLocaleString()} and ${RANGES[key][1].toLocaleString()}.`
      : undefined;
  const smtpHost = form.smtpHost.trim();
  const smtpFrom = form.smtpFrom.trim();
  const errors: Partial<Record<keyof PlatformConfig, string>> = {
    licenseValidationHours: rangeMessage('licenseValidationHours'),
    licenseGraceDays: rangeMessage('licenseGraceDays'),
    smtpPort: rangeMessage('smtpPort'),
    sessionTimeoutMinutes: rangeMessage('sessionTimeoutMinutes'),
    auditRetentionDays: rangeMessage('auditRetentionDays'),
    smtpHost:
      smtpHost && !isHostname(smtpHost) && !IPV4.test(smtpHost) && smtpHost !== 'localhost'
        ? 'Enter a valid hostname or IPv4 address.'
        : undefined,
    smtpFrom: !smtpFrom
      ? 'From address is required.'
      : smtpFrom.length > 254 || !isEmail(smtpFrom)
        ? 'Enter a valid email address.'
        : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);

  function update<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMessage('');
  }

  async function handleSave() {
    if (invalid) return;
    const p = parsed;
    if (
      p.licenseValidationHours === null ||
      p.licenseGraceDays === null ||
      p.smtpPort === null ||
      p.sessionTimeoutMinutes === null ||
      p.auditRetentionDays === null
    ) {
      return;
    }
    setMessage('');
    const ok = await saveAction.run({
      licenseValidationHours: p.licenseValidationHours,
      licenseGraceDays: p.licenseGraceDays,
      smtpHost,
      smtpPort: p.smtpPort,
      smtpFrom,
      sessionTimeoutMinutes: p.sessionTimeoutMinutes,
      auditRetentionDays: p.auditRetentionDays,
      aiDefaultMode: form.aiDefaultMode,
    });
    if (ok) {
      setForm((prev) => ({ ...prev, smtpHost, smtpFrom }));
      setDirty(false);
      setMessage('Platform configuration saved');
    }
  }

  function handleReset() {
    if (!window.confirm('Reset all platform configuration fields to their defaults? Unsaved changes will be lost.')) {
      return;
    }
    setForm(toForm(DEFAULT_CONFIG));
    setDirty(true);
    setMessage('Defaults restored. Save to apply them.');
  }

  const numberField = (key: keyof typeof RANGES, label: string) => (
    <div>
      <Input
        label={label}
        type="number"
        min={RANGES[key][0]}
        max={RANGES[key][1]}
        step={1}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      <FieldError message={errors[key]} />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Config"
        subtitle="System runtime, licensing scheduler, email delivery, and security defaults"
      />
      <FeedbackAlert message={loadWarning} severity="info" />
      <FeedbackAlert message={message} />
      <FeedbackAlert
        message={saveAction.error ? `${saveAction.error} Your changes are still in the form.` : ''}
        severity="error"
      />

      <PageCard
        title="License scheduler"
        action={
          <div className="flex items-center gap-2">
            {dirty && !saveAction.pending && (
              <span className="text-xs text-hope-muted">Unsaved changes</span>
            )}
            <Button size="sm" variant="outline" disabled={saveAction.pending} onClick={handleReset}>
              Reset
            </Button>
            <Button size="sm" disabled={saveAction.pending || invalid || !dirty} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saveAction.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {numberField('licenseValidationHours', 'Validation interval (hours)')}
          {numberField('licenseGraceDays', 'Grace period (days)')}
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
          <div>
            <Input
              label="SMTP host"
              placeholder="smtp.example.com"
              value={form.smtpHost}
              maxLength={253}
              onChange={(e) => update('smtpHost', e.target.value)}
              aria-invalid={!!errors.smtpHost}
            />
            <FieldError message={errors.smtpHost} />
          </div>
          {numberField('smtpPort', 'SMTP port')}
          <div>
            <Input
              label="From address"
              type="email"
              value={form.smtpFrom}
              maxLength={254}
              onChange={(e) => update('smtpFrom', e.target.value)}
              aria-invalid={!!errors.smtpFrom}
            />
            <FieldError message={errors.smtpFrom} />
          </div>
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
          {numberField('sessionTimeoutMinutes', 'Session timeout (minutes)')}
          {numberField('auditRetentionDays', 'Audit log retention (days)')}
          <Select
            label="Default AI mode for new tenants"
            value={form.aiDefaultMode}
            onChange={(e) => update('aiDefaultMode', e.target.value as PlatformConfig['aiDefaultMode'])}
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
