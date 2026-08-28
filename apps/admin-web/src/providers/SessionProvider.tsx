'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

type SessionState = {
  tenantId: string;
  userEmail: string;
  loading: boolean;
  ready: boolean;
};

const SessionContext = createContext<SessionState>({
  tenantId: '',
  userEmail: '',
  loading: true,
  ready: false,
});

let cachedTenantId: string | null = null;
let cachedUserEmail: string | null = null;
let resolvePromise: Promise<string> | null = null;

export function clearSessionCache() {
  cachedTenantId = null;
  cachedUserEmail = null;
  resolvePromise = null;
}

export async function prefetchSession(): Promise<void> {
  if (!getToken()) return;
  await fetchTenantId();
}

async function fetchTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const me = await api.me();
    cachedUserEmail = me.user.email;
    let tid = me.user.tenantIds[0];
    if (!tid) {
      const tenants = await api.getTenants();
      tid = tenants[0]?.id ?? '';
    }
    cachedTenantId = tid;
    return tid;
  })();

  try {
    return await resolvePromise;
  } finally {
    resolvePromise = null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(cachedTenantId ?? '');
  const [userEmail, setUserEmail] = useState(cachedUserEmail ?? '');
  const [loading, setLoading] = useState(!cachedTenantId);
  const [ready, setReady] = useState(!!cachedTenantId);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    if (cachedTenantId) {
      setTenantId(cachedTenantId);
      setUserEmail(cachedUserEmail ?? '');
      setLoading(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    fetchTenantId()
      .then((tid) => {
        if (cancelled) return;
        setTenantId(tid);
        setUserEmail(cachedUserEmail ?? '');
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace('/login');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SessionContext.Provider value={{ tenantId, userEmail, loading, ready }}>
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
