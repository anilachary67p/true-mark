'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';
import { Save } from 'lucide-react';

export default function QrCustomizationPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [width, setWidth] = useState(300);
  const [foreground, setForeground] = useState('#000000');
  const [background, setBackground] = useState('#ffffff');
  const [errorCorrection, setErrorCorrection] = useState('M');
  const [logoObjectKey, setLogoObjectKey] = useState('');
  const [logoSizeRatio, setLogoSizeRatio] = useState(0.2);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (!tenantId) return;
    api.getQrCustomization(tenantId).then((cfg) => {
      if (!cfg?.config) return;
      const c = cfg.config;
      if (typeof c.width === 'number') setWidth(c.width);
      if (typeof c.foregroundColor === 'string') setForeground(c.foregroundColor);
      if (typeof c.backgroundColor === 'string') setBackground(c.backgroundColor);
      if (typeof c.errorCorrectionLevel === 'string') setErrorCorrection(c.errorCorrectionLevel);
      if (typeof c.logoObjectKey === 'string') setLogoObjectKey(c.logoObjectKey);
      if (typeof c.logoSizeRatio === 'number') setLogoSizeRatio(c.logoSizeRatio);
    });
  }, [router, tenantId]);

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader
        title="QR Customization"
        subtitle="Visual customization does not alter authentication identity"
      />
      <FeedbackAlert message={message} />

      <PageCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Width"
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
          <Select
            label="Error correction"
            value={errorCorrection}
            onChange={(e) => setErrorCorrection(e.target.value)}
          >
            {['L', 'M', 'Q', 'H'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
          <Input
            label="Foreground"
            type="color"
            value={foreground}
            onChange={(e) => setForeground(e.target.value)}
          />
          <Input
            label="Background"
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          />
          <Input
            label="Logo object key (optional)"
            placeholder="tenant-id/logos/brand.png"
            value={logoObjectKey}
            onChange={(e) => setLogoObjectKey(e.target.value)}
          />
          <Input
            label="Logo size ratio"
            type="number"
            min={0.1}
            max={0.35}
            step={0.05}
            value={logoSizeRatio}
            onChange={(e) => setLogoSizeRatio(Number(e.target.value))}
          />
        </div>
        <Button
          className="mt-6"
          onClick={async () => {
            await api.saveQrCustomization(tenantId, {
              width,
              height: width,
              foregroundColor: foreground,
              backgroundColor: background,
              errorCorrectionLevel: errorCorrection,
              quietZone: 4,
              ...(logoObjectKey ? { logoObjectKey, logoSizeRatio } : {}),
            });
            setMessage('Configuration saved');
          }}
        >
          <Save className="h-4 w-4" />
          Save configuration
        </Button>
      </PageCard>
    </>
  );
}
