'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.push('/login');
  }, [router]);
}

export function useTenantId() {
  const [tenantId, setTenantId] = useState('');
  useEffect(() => {
    api.me().then(async (me) => {
      const tid = me.user.tenantIds[0];
      if (tid) return setTenantId(tid);
      const tenants = await api.getTenants();
      if (tenants[0]) setTenantId(tenants[0].id);
    });
  }, []);
  return tenantId;
}
