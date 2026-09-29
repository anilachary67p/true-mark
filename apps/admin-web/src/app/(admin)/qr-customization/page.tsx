'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { useAsyncAction, useAsyncData } from '@/lib/useAsync';
import { parseIntInRange } from '@/lib/validation';
import { Save } from 'lucide-react';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ERROR_LEVELS = ['L', 'M', 'Q', 'H'] as const;
const WIDTH_MIN = 64;
const WIDTH_MAX = 2048;
const MARGIN_MIN = 0;
const MARGIN_MAX = 16;
const LOGO_RATIO_MIN = 0.05;
const LOGO_RATIO_MAX = 0.3;
const OBJECT_KEY_MAX = 512;
const SAFE_OBJECT_KEY = /^[A-Za-z0-9/_.-]+$/;

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (HEX_COLOR.test(v)) return v.toLowerCase();
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(v);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() : null;
}

export default function QrCustomizationPage() {
  useAuthGuard();
  const tenantId = useTenantId();
  const [width, setWidth] = useState('300');
  const [margin, setMargin] = useState('4');
  const [foreground, setForeground] = useState('#000000');
  const [background, setBackground] = useState('#ffffff');
  const [errorCorrection, setErrorCorrection] = useState<string>('M');
  const [logoObjectKey, setLogoObjectKey] = useState('');
  const [logoSizeRatio, setLogoSizeRatio] = useState('0.2');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data, loading, error, reload } = useAsyncData(
    () => api.getQrCustomization(tenantId),
    [tenantId],
    { enabled: !!tenantId },
  );

  useEffect(() => {
    const c = data?.config;
    if (!c || typeof c !== 'object') return;
    if (typeof c.width === 'number' && Number.isFinite(c.width)) setWidth(String(c.width));
    if (typeof c.quietZone === 'number' && Number.isFinite(c.quietZone)) setMargin(String(c.quietZone));
    const fg = normalizeHex(c.foregroundColor);
    if (fg) setForeground(fg);
    const bg = normalizeHex(c.backgroundColor);
    if (bg) setBackground(bg);
    if (typeof c.errorCorrectionLevel === 'string' && (ERROR_LEVELS as readonly string[]).includes(c.errorCorrectionLevel)) {
      setErrorCorrection(c.errorCorrectionLevel);
    }
    if (typeof c.logoObjectKey === 'string') setLogoObjectKey(c.logoObjectKey);
    if (typeof c.logoSizeRatio === 'number' && Number.isFinite(c.logoSizeRatio)) {
      setLogoSizeRatio(String(c.logoSizeRatio));
    }
    setDirty(false);
  }, [data]);

  const saveAction = useAsyncAction((config: Record<string, unknown>) =>
    api.saveQrCustomization(tenantId, config),
  );

  const parsedWidth = parseIntInRange(width, WIDTH_MIN, WIDTH_MAX);
  const parsedMargin = parseIntInRange(margin, MARGIN_MIN, MARGIN_MAX);
  const trimmedLogoKey = logoObjectKey.trim();
  const ratio = logoSizeRatio.trim() === '' ? NaN : Number(logoSizeRatio);

  const errors: Record<string, string> = {};
  if (parsedWidth === null) errors.width = `Width must be a whole number between ${WIDTH_MIN} and ${WIDTH_MAX}.`;
  if (parsedMargin === null) errors.margin = `Margin must be a whole number between ${MARGIN_MIN} and ${MARGIN_MAX}.`;
  if (!HEX_COLOR.test(foreground)) errors.foreground = 'Use a 6-digit hex color, e.g. #000000.';
  if (!HEX_COLOR.test(background)) errors.background = 'Use a 6-digit hex color, e.g. #ffffff.';
  if (foreground.toLowerCase() === background.toLowerCase()) {
    errors.background = 'Background must differ from foreground so the code stays scannable.';
  }
  if (!(ERROR_LEVELS as readonly string[]).includes(errorCorrection)) errors.errorCorrection = 'Choose L, M, Q or H.';
  if (trimmedLogoKey) {
    if (trimmedLogoKey.length > OBJECT_KEY_MAX) {
      errors.logoObjectKey = `Object key must be at most ${OBJECT_KEY_MAX} characters.`;
    } else if (
      !SAFE_OBJECT_KEY.test(trimmedLogoKey) ||
      trimmedLogoKey.startsWith('/') ||
      trimmedLogoKey.split('/').some((s) => s === '' || s === '.' || s === '..')
    ) {
      errors.logoObjectKey = 'Use only letters, numbers, "/", "_", "." and "-".';
    } else if (tenantId && !trimmedLogoKey.startsWith(`tenants/${tenantId}/`)) {
      errors.logoObjectKey = `Key must start with tenants/${tenantId}/`;
    }
    if (!Number.isFinite(ratio) || ratio < LOGO_RATIO_MIN || ratio > LOGO_RATIO_MAX) {
      errors.logoSizeRatio = `Logo size ratio must be between ${LOGO_RATIO_MIN} and ${LOGO_RATIO_MAX}.`;
    }
  }
  const invalid = Object.keys(errors).length > 0;

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setMessage('');
    };
  }

  async function save() {
    if (invalid || parsedWidth === null || parsedMargin === null) return;
    setMessage('');
    const ok = await saveAction.run({
      width: parsedWidth,
      height: parsedWidth,
      foregroundColor: foreground,
      backgroundColor: background,
      errorCorrectionLevel: errorCorrection,
      quietZone: parsedMargin,
      ...(trimmedLogoKey ? { logoObjectKey: trimmedLogoKey, logoSizeRatio: ratio } : {}),
    });
    if (ok) {
      setDirty(false);
      setLogoObjectKey(trimmedLogoKey);
      setMessage('Configuration saved');
    }
  }

  if (!tenantId) {
    return (
      <EmptyState title="No organization selected" description="Your account is not linked to a tenant." />
    );
  }

  const fieldError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs text-hope-danger">{errors[key]}</p> : null;

  return (
    <>
      <PageHeader
        title="QR Customization"
        subtitle="Visual customization does not alter authentication identity"
      />
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

      {loading && !data ? (
        <PageSkeleton />
      ) : (
        <PageCard>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Width"
                type="number"
                min={WIDTH_MIN}
                max={WIDTH_MAX}
                step={1}
                value={width}
                onChange={(e) => edit(setWidth)(e.target.value)}
                aria-invalid={!!errors.width}
              />
              {fieldError('width')}
            </div>
            <div>
              <Select
                label="Error correction"
                value={errorCorrection}
                onChange={(e) => edit(setErrorCorrection)(e.target.value)}
              >
                {ERROR_LEVELS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
              {fieldError('errorCorrection')}
            </div>
            <div>
              <Input
                label="Margin (quiet zone)"
                type="number"
                min={MARGIN_MIN}
                max={MARGIN_MAX}
                step={1}
                value={margin}
                onChange={(e) => edit(setMargin)(e.target.value)}
                aria-invalid={!!errors.margin}
              />
              {fieldError('margin')}
            </div>
            <div />
            <div>
              <Input
                label="Foreground"
                type="color"
                value={foreground}
                onChange={(e) => edit(setForeground)(e.target.value)}
                aria-invalid={!!errors.foreground}
              />
              {fieldError('foreground')}
            </div>
            <div>
              <Input
                label="Background"
                type="color"
                value={background}
                onChange={(e) => edit(setBackground)(e.target.value)}
                aria-invalid={!!errors.background}
              />
              {fieldError('background')}
            </div>
            <div>
              <Input
                label="Logo object key (optional)"
                placeholder={`tenants/${tenantId}/logos/brand.png`}
                value={logoObjectKey}
                onChange={(e) => edit(setLogoObjectKey)(e.target.value)}
                aria-invalid={!!errors.logoObjectKey}
              />
              {fieldError('logoObjectKey')}
            </div>
            <div>
              <Input
                label="Logo size ratio"
                type="number"
                min={LOGO_RATIO_MIN}
                max={LOGO_RATIO_MAX}
                step={0.05}
                value={logoSizeRatio}
                disabled={!trimmedLogoKey}
                onChange={(e) => edit(setLogoSizeRatio)(e.target.value)}
                aria-invalid={!!errors.logoSizeRatio}
              />
              {fieldError('logoSizeRatio')}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button disabled={saveAction.pending || invalid || (!dirty && !!data?.config)} onClick={save}>
              <Save className="h-4 w-4" />
              {saveAction.pending ? 'Saving…' : 'Save configuration'}
            </Button>
            {dirty && !saveAction.pending && (
              <span className="text-xs text-hope-muted">You have unsaved changes.</span>
            )}
          </div>
        </PageCard>
      )}
    </>
  );
}
