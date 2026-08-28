'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { api, setToken, setRefreshToken } from '@/lib/api';
import { prefetchSession } from '@/providers/SessionProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody } from '@/components/ui/Card';

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
      await prefetchSession();
      router.push('/dashboard');
    } catch {
      setError('Invalid credentials');
    } finally {
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
                    autoComplete="current-password"
                    className="pl-10"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                </Button>
              </form>

              <p className="mt-5 space-y-1 text-center text-xs text-hope-muted">
                <span className="block">Super Admin: admin@truemark.local</span>
                <span className="block">Tenant Admin: tenant-admin@pureglow.com</span>
                <span className="block">Password: Admin123!@#</span>
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
