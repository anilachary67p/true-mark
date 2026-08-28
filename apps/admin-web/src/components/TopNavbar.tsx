'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search, Menu } from 'lucide-react';
import { useSession } from '@/providers/SessionProvider';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  organizations: 'Organizations',
  products: 'Products',
  'qr-codes': 'QR Codes',
  'qr-customization': 'QR Customization',
  'verification-history': 'Verification History',
  'ai-detection': 'AI Detection',
  'fraud-intelligence': 'Fraud Intelligence',
  investigations: 'Investigations',
  analytics: 'Analytics',
  domains: 'Domain Configuration',
  settings: 'Settings',
  'audit-log': 'Audit Log',
};

function UserAvatar({ email }: { email?: string }) {
  const initials = email
    ? email
        .split('@')[0]
        .split(/[._-]/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')
    : 'AD';

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold text-hope-dark">{email?.split('@')[0] ?? 'Admin'}</p>
        <p className="text-[10px] text-hope-muted">Administrator</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hope-primary text-xs font-bold text-white ring-2 ring-hope-primary/20">
        {initials}
      </div>
    </div>
  );
}

export function TopNavbar() {
  const pathname = usePathname();
  const { userEmail } = useSession();
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const title = PAGE_TITLES[segment] ?? 'Dashboard';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <div className="flex h-[70px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <button type="button" className="rounded-lg p-2 text-hope-secondary hover:bg-slate-100 md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            <span className="rounded-lg bg-hope-primary px-4 py-2 text-sm font-semibold text-white">
              Home
            </span>
            <span className="rounded-lg px-4 py-2 text-sm font-medium text-hope-secondary hover:bg-slate-50">
              {title}
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 md:gap-4">
          <div className="relative hidden max-w-xs flex-1 md:block lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hope-muted" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full rounded-xl border border-slate-200 bg-hope-body py-2.5 pl-10 pr-4 text-sm text-hope-dark outline-none transition placeholder:text-hope-muted focus:border-hope-primary focus:bg-white focus:ring-2 focus:ring-hope-primary/15"
            />
          </div>

          <button
            type="button"
            className="relative rounded-xl border border-slate-200 p-2.5 text-hope-secondary transition hover:bg-hope-body hover:text-hope-primary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-hope-danger ring-2 ring-white" />
          </button>

          <UserAvatar email={userEmail} />
        </div>
      </div>
    </header>
  );
}
