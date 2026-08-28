'use client';

import { useLicense } from '@/providers/LicenseProvider';
import { Button } from '@/components/ui/Button';
import { ShieldAlert } from 'lucide-react';

export function LicenseBlockedScreen() {
  const { license } = useLicense();

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="hope-card max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-hope-dark">License Renewal Required</h1>
        <p className="mt-3 text-sm text-hope-secondary">
          This TrueMark deployment is inactive because the license has expired and the grace period
          has ended. Please contact the product owner to renew your license.
        </p>
        {license?.organizationName && (
          <p className="mt-2 text-sm font-medium text-hope-dark">{license.organizationName}</p>
        )}
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm">
          <p className="font-semibold text-hope-dark">Product owner contact</p>
          <p className="mt-1 text-hope-secondary">
            Email: {license?.productOwnerEmail ?? 'licensing@truemark.local'}
          </p>
          {license?.productOwnerPhone && (
            <p className="text-hope-secondary">Phone: {license.productOwnerPhone}</p>
          )}
        </div>
        <p className="mt-4 text-xs text-hope-muted">
          After renewal, install the updated license file or ask your platform administrator to
          apply the new license.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>
          Check again
        </Button>
      </div>
    </div>
  );
}
