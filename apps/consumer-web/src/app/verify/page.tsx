'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ACCEPTED_IMAGE_TYPES,
  errorText,
  postJson,
  publicRequest,
  resolveVerifyHostname,
  validateImage,
} from '@/lib/api';

const MAX_CODE_LENGTH = 64;
const MAX_QR_PAYLOAD_LENGTH = 2048;

const QrScanner = dynamic(
  () => import('@/components/QrScanner').then((mod) => ({ default: mod.QrScanner })),
  {
    ssr: false,
    loading: () => (
      <p style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>Loading scanner…</p>
    ),
  },
);

function humanize(value: string | undefined | null): string {
  return (value ?? '').replace(/_/g, ' ').trim();
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
  const inFlight = useRef(false);
  const lastUrlParam = useRef<string | null>(null);

  useEffect(() => {
    const hostname = resolveVerifyHostname();
    publicRequest<{ companyDisplayName?: string | null }>(
      `/verify/branding?hostname=${encodeURIComponent(hostname)}`,
    )
      .then((data) => {
        if (typeof data?.companyDisplayName === 'string') setCompanyDisplayName(data.companyDisplayName);
      })
      .catch(() => {
        // Branding is optional; page still works without it.
      });
  }, []);

  const runVerification = useCallback(async (path: '/verify/qr' | '/verify/code', payload: object) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await postJson<VerifyResult>(path, { ...payload, hostname: resolveVerifyHostname() });
      if (!data || typeof data.result !== 'string') {
        setError('Unexpected response from the verification service.');
        return;
      }
      setResult(data);
    } catch (err) {
      setError(errorText(err, 'Verification failed. Please try again.'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const verifyQr = useCallback(
    (url: string) => {
      const payload = url.trim();
      if (!payload) return;
      if (payload.length > MAX_QR_PAYLOAD_LENGTH) {
        setError('This QR code is not a valid TrueMark code.');
        return;
      }
      void runVerification('/verify/qr', { url: payload });
    },
    [runVerification],
  );

  useEffect(() => {
    const qrUrl = searchParams.get('url');
    if (!qrUrl || qrUrl === lastUrlParam.current) return;
    lastUrlParam.current = qrUrl;
    verifyQr(qrUrl);
  }, [searchParams, verifyQr]);

  function verifyManual(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Please enter the verification code printed on the product.');
      return;
    }
    void runVerification('/verify/code', { code: normalized });
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
                maxLength={MAX_CODE_LENGTH}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={error ? 'verify-error' : undefined}
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
              disabled={loading || !code.trim()}
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

      {loading && result === null && (
        <p role="status" style={{ textAlign: 'center', color: '#666', marginTop: '1rem' }}>
          Verifying…
        </p>
      )}

      {error && (
        <p id="verify-error" role="alert" style={{ color: '#dc2626', textAlign: 'center', marginTop: '1rem' }}>
          {error}
        </p>
      )}

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
              {humanize(result.result)}
            </h2>
          </div>
          {result.message && (
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>{result.message}</p>
          )}
          {result.product && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <Row label="Product" value={result.product.name} />
              <Row label="Category" value={result.product.category} />
              <Row label="Product type" value={humanize(result.product.productType)} />
              {result.product.productCode && (
                <Row label="Product code" value={result.product.productCode} />
              )}
              {result.product.batch && <Row label="Batch" value={result.product.batch} />}
              {result.product.serial && <Row label="Serial" value={result.product.serial} />}
              {Array.isArray(result.product.tags) && result.product.tags.length > 0 && (
                <Row label="Tags" value={result.product.tags.join(', ')} />
              )}
            </div>
          )}
          {result.aiAvailable && result.verificationPublicId && (
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
            type="button"
            onClick={() => {
              setResult(null);
              setError('');
              setCode('');
            }}
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
  const [uploadedViews, setUploadedViews] = useState<string[]>([]);
  const busyRef = useRef(false);

  const finished = status !== '' && !['PENDING', 'IMAGE_NOT_CLEAR'].includes(status);
  const missingViews = requiredViews.filter((view) => !uploadedViews.includes(view));

  async function withBusy(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setAiError('');
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function startAi() {
    return withBusy(async () => {
      try {
        const data = await postJson<{
          status?: string;
          message?: string;
          jobId?: string;
          requiredViews?: unknown;
        }>('/verify/ai/initiate', { verificationPublicId });
        if (data.status === 'AI_NOT_CONFIGURED') {
          setAiError('AI validation is not configured for this product.');
          return;
        }
        if (data.status === 'AI_UNAVAILABLE' || !data.jobId) {
          setAiError(data.message ?? 'AI validation is temporarily unavailable.');
          return;
        }
        setJobId(data.jobId);
        setStatus(data.status ?? 'PENDING');
        setUploadedViews([]);
        if (Array.isArray(data.requiredViews) && data.requiredViews.every((v) => typeof v === 'string')) {
          setRequiredViews(data.requiredViews.length > 0 ? (data.requiredViews as string[]) : ['FRONT']);
        }
      } catch (err) {
        setAiError(errorText(err, 'Could not start AI validation.'));
      }
    });
  }

  function uploadImage(viewAngle: string, file: File, input: HTMLInputElement) {
    if (!jobId) return;
    const invalid = validateImage(file);
    if (invalid) {
      setAiError(invalid);
      input.value = '';
      return;
    }
    return withBusy(async () => {
      const form = new FormData();
      form.append('image', file);
      form.append('viewAngle', viewAngle);
      try {
        const data = await publicRequest<{ status?: string; message?: string }>(
          `/verify/ai/${encodeURIComponent(jobId)}/images`,
          { method: 'POST', body: form },
        );
        if (data.status === 'IMAGE_NOT_CLEAR') {
          setAiError(data.message ?? `The ${viewAngle.toLowerCase()} photo is not clear enough. Please retake it.`);
          setUploadedViews((views) => views.filter((v) => v !== viewAngle));
          input.value = '';
          return;
        }
        setUploadedViews((views) => (views.includes(viewAngle) ? views : [...views, viewAngle]));
      } catch (err) {
        setAiError(errorText(err, 'Image upload failed. Please try again.'));
        input.value = '';
      }
    });
  }

  function processAi() {
    if (!jobId || missingViews.length > 0) return;
    return withBusy(async () => {
      try {
        const data = await postJson<{ status?: string; confidence?: unknown }>(
          `/verify/ai/${encodeURIComponent(jobId)}/process`,
          {},
        );
        setStatus(data.status ?? '');
        const c = Number(data.confidence);
        if (data.confidence != null && Number.isFinite(c)) setConfidence(Math.min(1, Math.max(0, c)));
        if (data.status === 'AI_UNAVAILABLE') setAiError('AI validation is temporarily unavailable.');
      } catch (err) {
        setAiError(errorText(err, 'AI processing failed. Please try again.'));
      }
    });
  }

  if (!jobId) {
    return (
      <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <p style={{ fontSize: 14, color: '#2563eb', textAlign: 'center', marginBottom: 8 }}>
          Optional physical product validation
          {aiMode ? ` (${humanize(aiMode).toLowerCase()})` : ''}
        </p>
        <button
          type="button"
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
        {aiError && (
          <p role="alert" style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
            {aiError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        AI capture — upload: {requiredViews.map(humanize).join(', ')}
      </p>
      {requiredViews.map((angle) => (
        <label key={angle} style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          {humanize(angle)} image {uploadedViews.includes(angle) && <span style={{ color: '#16a34a' }}>✓ uploaded</span>}
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            capture="environment"
            disabled={busy || finished}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(angle, f, e.currentTarget);
            }}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
      ))}
      {missingViews.length > 0 && !finished && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          Still needed: {missingViews.map(humanize).join(', ')}
        </p>
      )}
      <button
        type="button"
        onClick={processAi}
        disabled={busy || finished || missingViews.length > 0}
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
        {busy ? 'Working…' : 'Run AI analysis'}
      </button>
      {status && (
        <p role="status" style={{ fontSize: 13, marginTop: 8 }}>
          Status: {humanize(status)}
        </p>
      )}
      {confidence != null && (
        <p style={{ fontSize: 13, marginTop: 4 }}>
          AI confidence: {(confidence * 100).toFixed(0)}% — probabilistic evidence only, not proof
          of authenticity.
        </p>
      )}
      {aiError && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
          {aiError}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
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
