'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

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

  return (
    <AdminShell>
      <h1>QR Code Customization</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>
        Visual customization does not alter authentication identity.
      </p>
      {message && <p style={{ color: '#0a7' }}>{message}</p>}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label>
            Width
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 4,
              }}
            />
          </label>
          <label>
            Foreground
            <input
              type="color"
              value={foreground}
              onChange={(e) => setForeground(e.target.value)}
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <label>
            Error Correction
            <select
              value={errorCorrection}
              onChange={(e) => setErrorCorrection(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 4,
              }}
            >
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="Q">Q</option>
              <option value="H">H</option>
            </select>
          </label>
          <label>
            Logo object key (optional)
            <input
              type="text"
              value={logoObjectKey}
              onChange={(e) => setLogoObjectKey(e.target.value)}
              placeholder="tenant-id/logos/brand.png"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 4,
              }}
            />
          </label>
          <label>
            Logo size ratio
            <input
              type="number"
              min={0.1}
              max={0.35}
              step={0.05}
              value={logoSizeRatio}
              onChange={(e) => setLogoSizeRatio(Number(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 4,
              }}
            />
          </label>
        </div>
        <button
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
          onClick={async () => {
            if (!tenantId) return;
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
          Save Configuration
        </button>
      </div>
    </AdminShell>
  );
}
