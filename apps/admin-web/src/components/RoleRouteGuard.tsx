'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/providers/SessionProvider';
import { canAccessPath } from '@/lib/roleAccess';

export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { roles, ready } = useSession();

  const allowed = ready && canAccessPath(pathname, roles);
  const hasNoRoles = ready && roles.length === 0;

  useEffect(() => {
    if (!ready || allowed || hasNoRoles) return;
    router.replace('/dashboard');
  }, [ready, allowed, hasNoRoles, router]);

  if (!ready) return null;

  if (hasNoRoles) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-hope-dark">No access assigned</p>
        <p className="mt-2 text-sm text-hope-secondary">
          Your account has no role in any organization. Contact your administrator.
        </p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
