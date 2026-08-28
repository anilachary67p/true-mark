'use client';

import { useLicense } from '@/providers/LicenseProvider';
import { LicenseBanner } from '@/components/LicenseBanner';
import { LicenseBlockedScreen } from '@/components/LicenseBlockedScreen';

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { loading, isBlocked } = useLicense();

  if (loading) return <>{children}</>;

  if (isBlocked) {
    return <LicenseBlockedScreen />;
  }

  return (
    <>
      <LicenseBanner />
      {children}
    </>
  );
}
