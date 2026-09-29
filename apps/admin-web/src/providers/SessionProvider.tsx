'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage, getToken, isApiError } from '@/lib/api';
import { formatPrimaryRole } from '@/lib/roleLabels';
import { isPlatformAdminRole } from '@/lib/roleAccess';

type SessionState = {
  tenantId: string;
  userEmail: string;
  roles: string[];
  roleLabel: string;
  isPlatformAdmin: boolean;
  loading: boolean;
  ready: boolean;
  error: string;
  retry: () => void;
};

const SessionContext = createContext<SessionState>({
  tenantId: '',
  userEmail: '',
  roles: [],
  roleLabel: '',
  isPlatformAdmin: false,
  loading: true,
  ready: false,
  error: '',
  retry: () => {},
});

type CachedSession = { tenantId: string; userEmail: string; roles: string[] };

let cachedSession: CachedSession | null = null;
let resolvePromise: Promise<CachedSession> | null = null;

export function clearSessionCache() {
  cachedSession = null;
  resolvePromise = null;
}

export async function prefetchSession(): Promise<void> {
  if (!getToken()) return;
  await fetchSession();
}

async function fetchSession(): Promise<CachedSession> {
  if (cachedSession) return cachedSession;
  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const me = await api.me();
    const roles = Array.isArray(me.user?.roles) ? me.user.roles : [];
    const tenantIds = Array.isArray(me.user?.tenantIds) ? me.user.tenantIds : [];
    let tenantId = tenantIds[0] ?? '';
    if (!tenantId && isPlatformAdminRole(roles)) {
      const tenants = await api.getTenants().catch(() => []);
      tenantId = tenants[0]?.id ?? '';
    }
    const session = { tenantId, userEmail: me.user?.email ?? '', roles };
    cachedSession = session;
    return session;
  })();

  try {
    return await resolvePromise;
  } finally {
    resolvePromise = null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<CachedSession | null>(cachedSession);
  const [loading, setLoading] = useState(!cachedSession);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const roles = session?.roles ?? [];

  const retry = useCallback(() => {
    setError('');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    if (cachedSession) {
      setSession(cachedSession);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 is handled centrally (redirect to login); anything else is shown with a retry.
        if (!isApiError(err, 401)) setError(errorMessage(err, 'Unable to load your session.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  return (
    <SessionContext.Provider
      value={{
        tenantId: session?.tenantId ?? '',
        userEmail: session?.userEmail ?? '',
        roles,
        roleLabel: formatPrimaryRole(roles),
        isPlatformAdmin: isPlatformAdminRole(roles),
        loading,
        ready: !!session,
        error,
        retry,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export function useTenantId() {
  return useContext(SessionContext).tenantId;
}
