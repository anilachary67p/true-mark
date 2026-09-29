'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/providers/SessionProvider';

export type LicenseStatusView = {
  tenantId: string;
  licenseId?: string;
  organizationName?: string;
  deploymentModel?: string;
  commercialModel?: string;
  status: string;
  validFrom?: string;
  validUntil?: string;
  daysUntilExpiry?: number;
  graceDaysRemaining?: number;
  productOwnerEmail?: string;
  productOwnerPhone?: string;
  message?: string;
};

type LicenseContextValue = {
  license: LicenseStatusView | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isBlocked: boolean;
  showWarning: boolean;
  showGraceModal: boolean;
};

const LicenseContext = createContext<LicenseContextValue>({
  license: null,
  loading: true,
  refresh: async () => {},
  isBlocked: false,
  showWarning: false,
  showGraceModal: false,
});

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { tenantId, isPlatformAdmin, ready } = useSession();
  const [license, setLicense] = useState<LicenseStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  // Platform admins manage licenses for every tenant; one tenant's license must never lock them out.
  const applies = ready && !isPlatformAdmin && !!tenantId;

  const refresh = useCallback(async () => {
    if (!applies) return;
    setLoading(true);
    try {
      setLicense(await api.getLicenseStatus(tenantId));
    } catch {
      // Keep the last known status on transient failures; the API enforces licensing server-side.
    } finally {
      setLoading(false);
    }
  }, [applies, tenantId]);

  useEffect(() => {
    if (!ready) return;
    if (!applies) {
      setLicense(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [ready, applies, refresh]);

  const status = applies ? (license?.status ?? 'ACTIVE') : 'ACTIVE';
  const isBlocked = status === 'BLOCKED' || status === 'MISSING';
  const showGraceModal = status === 'EXPIRED_GRACE';
  const showWarning = ['WARNING_30', 'WARNING_15', 'WARNING_7', 'EXPIRED_GRACE'].includes(status);

  return (
    <LicenseContext.Provider
      value={{ license, loading, refresh, isBlocked, showWarning, showGraceModal }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
