import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-hope-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-hope-dark">Page not found</h1>
      <p className="mt-2 text-sm text-hope-secondary">The page you are looking for does not exist or has moved.</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center rounded-xl bg-hope-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-hope-primary-dark"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
