'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/providers/SessionProvider';
import { canAccessPath } from '@/lib/roleAccess';

export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { roles, ready } = useSession();

  useEffect(() => {
    if (!ready || roles.length === 0) return;
    if (!canAccessPath(pathname, roles)) {
      router.replace('/dashboard');
    }
  }, [pathname, roles, ready, router]);

  if (!ready) return null;

  if (!canAccessPath(pathname, roles)) {
    return null;
  }

  return <>{children}</>;
}
