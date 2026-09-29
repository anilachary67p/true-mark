'use client';

import { useEffect } from 'react';

export default function VerifyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" style={{ maxWidth: 480, margin: '0 auto', padding: '4rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</h1>
      <p style={{ color: '#666', marginTop: 8 }}>We could not load the verification page. Please try again.</p>
      {error.digest && <p style={{ color: '#999', fontSize: 12, fontFamily: 'monospace' }}>Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 16, padding: '0.75rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}
