import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '4rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Page not found</h1>
      <p style={{ color: '#666', marginTop: 8 }}>This link is not a valid TrueMark verification page.</p>
      <Link href="/verify" style={{ display: 'inline-block', marginTop: 16, color: '#2563eb', fontWeight: 600 }}>
        Verify a product
      </Link>
    </div>
  );
}
