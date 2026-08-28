'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useTenantId } from '@/lib/hooks';

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
  const tenantId = useTenantId();
  const [license, setLicense] = useState<LicenseStatusView | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setLicense(await api.getLicenseStatus(tenantId));
    } catch {
      setLicense(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) refresh();
  }, [tenantId, refresh]);

  const status = license?.status ?? 'ACTIVE';
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
