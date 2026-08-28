'use client';

import { useLicense } from '@/providers/LicenseProvider';

const MESSAGES: Record<string, string> = {
  WARNING_30: 'Your license expires in 30 days or less. Contact the product owner to renew.',
  WARNING_15: 'Your license expires in 15 days or less. Please arrange renewal soon.',
  WARNING_7: 'Your license expires in 7 days or less. Renewal is urgent.',
  EXPIRED_GRACE: 'Your license has expired. You are in the grace period — renew immediately.',
};

export function LicenseBanner() {
  const { license, showWarning } = useLicense();
  if (!showWarning || !license) return null;

  const tone =
    license.status === 'EXPIRED_GRACE' || license.status === 'WARNING_7'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{MESSAGES[license.status] ?? 'License renewal required soon.'}</p>
      <p className="mt-1 text-xs opacity-90">
        Valid until {license.validUntil ? new Date(license.validUntil).toLocaleDateString() : '—'}
        {license.productOwnerEmail ? ` · Contact: ${license.productOwnerEmail}` : ''}
        {license.productOwnerPhone ? ` · ${license.productOwnerPhone}` : ''}
      </p>
    </div>
  );
}
