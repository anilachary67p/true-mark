'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div role="alert" style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>TrueMark Admin is temporarily unavailable</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>An unexpected error occurred. Please try again.</p>
          {error.digest && <p style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: '10px 16px', borderRadius: 12, border: 0, background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
