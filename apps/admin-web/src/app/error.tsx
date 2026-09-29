'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ErrorFallback';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorFallback digest={error.digest} onRetry={reset} />;
}
