'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while rendering this page. You can try again, or go back to the dashboard.',
  digest,
  onRetry,
  homeHref = '/',
}: {
  title?: string;
  message?: string;
  digest?: string;
  onRetry?: () => void;
  homeHref?: string;
}) {
  return (
    <div role="alert" className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-hope-danger">!</div>
      <h1 className="text-lg font-semibold text-hope-dark">{title}</h1>
      <p className="mt-2 text-sm text-hope-secondary">{message}</p>
      {digest && <p className="mt-2 font-mono text-xs text-slate-400">Reference: {digest}</p>}
      <div className="mt-6 flex gap-3">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        <Link
          href={homeHref}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-hope-dark hover:bg-slate-50"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
