'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { api, clearAuth, getToken, isApiError, setToken, setRefreshToken } from '@/lib/api';
import { clearSessionCache, prefetchSession } from '@/providers/SessionProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody } from '@/components/ui/Card';

const SHOW_DEMO_CREDENTIALS = process.env.NODE_ENV === 'development';

/** Only allow same-origin relative redirects to avoid open-redirects via `?next=`. */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) {
    return '/dashboard';
  }
  return raw;
}

function loginErrorMessage(error: unknown): string {
  if (isApiError(error, 401)) return 'Invalid email or password.';
  if (isApiError(error, 429)) return 'Too many sign-in attempts. Please wait a minute and try again.';
  if (isApiError(error, 0)) return error.message;
  if (isApiError(error) && error.status >= 500) {
    return 'Sign-in is temporarily unavailable. Please try again shortly.';
  }
  return 'Unable to sign in. Please try again.';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nextPath, setNextPath] = useState('/dashboard');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'expired') {
      setNotice('Your session has expired. Please sign in again.');
    }
    setNextPath(safeNextPath(params.get('next')));
    if (getToken() && params.get('reason') !== 'expired') {
      router.replace(safeNextPath(params.get('next')));
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    clearAuth();
    clearSessionCache();
    try {
      const res = await api.login(email.trim(), password);
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      await prefetchSession();
      router.replace(nextPath);
    } catch (err) {
      clearAuth();
      clearSessionCache();
      setError(loginErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-hope-primary p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-black">
            TM
          </div>
          <span className="text-xl font-bold">TrueMark</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">Product authentication, simplified.</h2>
          <p className="mt-3 max-w-md text-white/80">
            Manage verifications, QR codes, and fraud intelligence from one clean admin dashboard.
          </p>
        </div>
        <p className="text-sm text-white/60">© TrueMark Admin Portal</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-hope-body p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hope-primary text-xs font-black text-white">
                TM
              </div>
              <span className="text-lg font-bold text-hope-dark">TrueMark</span>
            </div>
          </div>

          <Card>
            <CardBody>
              <h1 className="text-2xl font-bold text-hope-dark">Sign In</h1>
              <p className="mt-1 text-sm text-hope-secondary">Enter your credentials to continue</p>

              {notice && !error && (
                <div className="mt-4">
                  <Alert variant="warning">{notice}</Alert>
                </div>
              )}
              {error && (
                <div className="mt-4">
                  <Alert variant="error">{error}</Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-[42px] h-4 w-4 text-hope-muted" />
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                    autoComplete="email"
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-[42px] h-4 w-4 text-hope-muted" />
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={256}
                    autoComplete="current-password"
                    className="pl-10"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                </Button>
              </form>

              {SHOW_DEMO_CREDENTIALS && (
                <p className="mt-5 space-y-1 text-center text-xs text-hope-muted">
                  <span className="block">Super Admin: admin@truemark.local</span>
                  <span className="block">Tenant Admin: tenant-admin@pureglow.com</span>
                  <span className="block">Password: Admin123!@#</span>
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
