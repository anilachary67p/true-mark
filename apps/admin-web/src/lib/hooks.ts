'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

/** Lightweight guard — session is loaded once in SessionProvider */
export function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);
}

export { useTenantId, useSession } from '@/providers/SessionProvider';
