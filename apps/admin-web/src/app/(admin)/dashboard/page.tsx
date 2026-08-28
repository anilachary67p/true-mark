'use client';

import { PlatformDashboard } from '@/components/PlatformDashboard';
import { TenantDashboard } from '@/components/TenantDashboard';
import { useSession } from '@/lib/hooks';
import { isPlatformAdminRole } from '@/lib/roleAccess';

export default function DashboardPage() {
  const { roles, ready } = useSession();

  if (!ready) return null;

  if (isPlatformAdminRole(roles)) {
    return <PlatformDashboard />;
  }

  return <TenantDashboard />;
}
