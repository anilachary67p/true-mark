'use client';

import { AdminShell } from '@/components/AdminShell';
import { LicenseGate } from '@/components/LicenseGate';
import { RoleRouteGuard } from '@/components/RoleRouteGuard';
import { SessionProvider } from '@/providers/SessionProvider';
import { LicenseProvider } from '@/providers/LicenseProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LicenseProvider>
        <AdminShell>
          <LicenseGate>
            <RoleRouteGuard>{children}</RoleRouteGuard>
          </LicenseGate>
        </AdminShell>
      </LicenseProvider>
    </SessionProvider>
  );
}
