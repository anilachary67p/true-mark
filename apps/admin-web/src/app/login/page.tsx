'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, setRefreshToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      router.push('/dashboard');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '2rem', borderRadius: 8, width: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>TrueMark Admin</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: 14 }}>Sign in to manage tenants and products</p>
        {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: 14 }}>{error}</p>}
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid #ddd', borderRadius: 4 }} />
        </label>
        <label style={{ display: 'block', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid #ddd', borderRadius: 4 }} />
        </label>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
