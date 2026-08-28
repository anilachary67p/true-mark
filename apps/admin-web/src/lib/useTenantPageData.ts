'use client';

import { useEffect, useState } from 'react';
import { useTenantId } from '@/lib/hooks';

/**
 * Fetch page data as soon as tenantId is available (cached from SessionProvider).
 */
export function useTenantPageData<T>(
  fetcher: (tenantId: string) => Promise<T>,
  deps: unknown[] = [],
) {
  const tenantId = useTenantId();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetcher(tenantId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, ...deps]);

  return { data, loading: !tenantId || loading, error, tenantId };
}
