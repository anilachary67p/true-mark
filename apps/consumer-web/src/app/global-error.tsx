'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>TrueMark verification is temporarily unavailable</h1>
        <p style={{ color: '#666' }}>Please try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 16, padding: '0.75rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
