'use client';

import { AdminShell } from '@/components/AdminShell';
import { LicenseGate } from '@/components/LicenseGate';
import { SessionProvider } from '@/providers/SessionProvider';
import { LicenseProvider } from '@/providers/LicenseProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LicenseProvider>
        <AdminShell>
          <LicenseGate>{children}</LicenseGate>
        </AdminShell>
      </LicenseProvider>
    </SessionProvider>
  );
}
