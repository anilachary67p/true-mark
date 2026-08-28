'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const QrScanner = dynamic(
  () => import('@/components/QrScanner').then((mod) => ({ default: mod.QrScanner })),
  {
    ssr: false,
    loading: () => (
      <p style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>Loading scanner…</p>
    ),
  },
);

function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3001`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
}

function resolveVerifyHostname(): string {
  if (process.env.NEXT_PUBLIC_VERIFY_HOSTNAME) {
    return process.env.NEXT_PUBLIC_VERIFY_HOSTNAME;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'verify.localhost';
    }
    return host;
  }
  return 'verify.localhost';
}

interface VerifyResult {
  result: string;
  message: string;
  riskLevel: string;
  verificationPublicId: string;
  aiAvailable: boolean;
  aiMode: string;
  product?: {
    name: string;
    category: string;
    productType: string;
    productCode?: string;
    batch?: string;
    serial?: string;
    tags?: string[];
  };
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const hostname = resolveVerifyHostname();
    const apiUrl = resolveApiUrl();
    fetch(`${apiUrl}/api/v1/public/verify/branding?hostname=${encodeURIComponent(hostname)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { companyDisplayName?: string | null } | null) => {
        if (data?.companyDisplayName) setCompanyDisplayName(data.companyDisplayName);
      })
      .catch(() => {
        // Branding is optional; page still works without it.
      });
  }, []);

  const verifyQr = useCallback(async (url: string) => {
    const payload = url.trim();
    const hostname = resolveVerifyHostname();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const apiUrl = resolveApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/public/verify/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: payload, hostname }),
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as VerifyResult & { message?: string }) : null;
      if (!res.ok) {
        setError(data?.message ?? `Verification request failed (${res.status})`);
        return;
      }
      if (!data) {
        setError('Empty response from verification service.');
        return;
      }
      setResult(data);
    } catch (err) {
      const hint =
        err instanceof TypeError
          ? 'Cannot reach the API. Start the stack with pnpm dev (API on port 3001).'
          : 'Verification failed. Please try again.';
      setError(hint);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const qrUrl = searchParams.get('url');
    if (qrUrl) verifyQr(qrUrl);
  }, [searchParams, verifyQr]);

  async function verifyManual(e: React.FormEvent) {
    e.preventDefault();
    const hostname = resolveVerifyHostname();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const apiUrl = resolveApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/public/verify/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, hostname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? `Verification request failed (${res.status})`);
        return;
      }
      setResult(data);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = result && ['VERIFIED', 'REVERIFIED'].includes(result.result);
  const isWarning =
    result && ['SUSPICIOUS', 'POSSIBLE_CLONE', 'POSSIBLE_COUNTERFEIT'].includes(result.result);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {companyDisplayName && (
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#2563eb',
              letterSpacing: '0.02em',
              marginBottom: 10,
            }}
          >
            {companyDisplayName}
          </p>
        )}
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>TRUE MARK</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Verify your product authenticity</p>
      </header>

      {!result && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
            Scan the QR code to verify your product.
          </p>
          <QrScanner onScan={verifyQr} disabled={loading} />
          <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#888' }}>— OR —</div>
          <form onSubmit={verifyManual}>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Enter verification code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TM-XXXX-XXXX-XXXX"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 8,
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  textAlign: 'center',
                  letterSpacing: 2,
                }}
              />
            </label>
            <button
              type="submit"
              disabled={loading || !code}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {loading ? 'Verifying...' : 'VERIFY'}
            </button>
          </form>
        </div>
      )}

      {error && <p style={{ color: '#dc2626', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}

      {result && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: 48 }}>{isSuccess ? '✓' : isWarning ? '⚠' : '✕'}</span>
            <h2
              style={{
                marginTop: 8,
                color: isSuccess ? '#16a34a' : isWarning ? '#d97706' : '#dc2626',
              }}
            >
              {result.result.replace(/_/g, ' ')}
            </h2>
          </div>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>
            {result.message}
          </p>
          {result.product && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <Row label="Product" value={result.product.name} />
              <Row label="Category" value={result.product.category} />
              <Row label="Product type" value={result.product.productType} />
              {result.product.productCode && (
                <Row label="Product code" value={result.product.productCode} />
              )}
              {result.product.batch && <Row label="Batch" value={result.product.batch} />}
              {result.product.serial && <Row label="Serial" value={result.product.serial} />}
              {result.product.tags && result.product.tags.length > 0 && (
                <Row label="Tags" value={result.product.tags.join(', ')} />
              )}
            </div>
          )}
          {result.aiAvailable && (
            <AiCapturePanel
              verificationPublicId={result.verificationPublicId}
              aiMode={result.aiMode}
            />
          )}
          {!result.aiAvailable && result.aiMode === 'AI_DISABLED' && (
            <p style={{ marginTop: '1rem', fontSize: 13, color: '#888', textAlign: 'center' }}>
              Additional physical AI validation is not enabled for this product.
            </p>
          )}
          <button
            onClick={() => setResult(null)}
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 8,
            }}
          >
            Verify Another
          </button>
        </div>
      )}
    </div>
  );
}

function AiCapturePanel({
  verificationPublicId,
  aiMode,
}: {
  verificationPublicId: string;
  aiMode: string;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [aiError, setAiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requiredViews, setRequiredViews] = useState<string[]>(['FRONT', 'BACK']);

  async function startAi() {
    setBusy(true);
    setAiError('');
    try {
      const res = await fetch(`${resolveApiUrl()}/api/v1/public/verify/ai/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationPublicId }),
      });
      const data = await res.json();
      if (data.status === 'AI_NOT_CONFIGURED') {
        setAiError('AI validation is not configured for this product.');
        return;
      }
      if (data.status === 'AI_UNAVAILABLE') {
        setAiError(data.message ?? 'AI validation is temporarily unavailable.');
        return;
      }
      setJobId(data.jobId);
      setStatus(data.status);
      if (Array.isArray(data.requiredViews)) {
        setRequiredViews(data.requiredViews as string[]);
      }
    } catch {
      setAiError('Could not start AI validation.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(viewAngle: string, file: File) {
    if (!jobId) return;
    setBusy(true);
    setAiError('');
    const form = new FormData();
    form.append('image', file);
    form.append('viewAngle', viewAngle);
    try {
      const res = await fetch(`${resolveApiUrl()}/api/v1/public/verify/ai/${jobId}/images`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (data.status === 'IMAGE_NOT_CLEAR') {
        setAiError(data.message ?? 'Image not clear enough.');
      }
    } catch {
      setAiError('Image upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function processAi() {
    if (!jobId) return;
    setBusy(true);
    try {
      const res = await fetch(`${resolveApiUrl()}/api/v1/public/verify/ai/${jobId}/process`, {
        method: 'POST',
      });
      const data = await res.json();
      setStatus(data.status);
      if (data.confidence != null) setConfidence(data.confidence);
      if (data.status === 'AI_UNAVAILABLE') setAiError('AI validation unavailable.');
    } catch {
      setAiError('AI processing failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!jobId) {
    return (
      <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <p style={{ fontSize: 14, color: '#2563eb', textAlign: 'center', marginBottom: 8 }}>
          Optional physical product validation ({aiMode.replace(/_/g, ' ').toLowerCase()})
        </p>
        <button
          onClick={startAi}
          disabled={busy}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
          }}
        >
          {busy ? 'Starting…' : 'Validate with AI'}
        </button>
        {aiError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{aiError}</p>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        AI capture — upload: {requiredViews.join(', ')}
      </p>
      {requiredViews.map((angle) => (
        <label key={angle} style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          {angle} image
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(angle, f);
            }}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
      ))}
      <button
        onClick={processAi}
        disabled={busy}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#16a34a',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          marginTop: 8,
        }}
      >
        {busy ? 'Processing…' : 'Run AI analysis'}
      </button>
      {status && <p style={{ fontSize: 13, marginTop: 8 }}>Status: {status}</p>}
      {confidence != null && (
        <p style={{ fontSize: 13, marginTop: 4 }}>
          AI confidence: {(confidence * 100).toFixed(0)}% — probabilistic evidence only, not proof
          of authenticity.
        </p>
      )}
      {aiError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{aiError}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.375rem 0',
        fontSize: 14,
      }}
    >
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
