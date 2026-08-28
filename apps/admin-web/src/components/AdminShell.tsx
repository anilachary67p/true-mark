'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  QrCode,
  Palette,
  History,
  Bot,
  Shield,
  Search,
  BarChart3,
  Globe,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { clearAuth, getRefreshToken, api } from '@/lib/api';
import { clearSessionCache, useSession } from '@/providers/SessionProvider';
import { TopNavbar } from '@/components/TopNavbar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

const NAV_GROUPS = [
  {
    title: 'Home',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/organizations', label: 'Organizations', icon: Building2 },
      { href: '/products', label: 'Products', icon: Package },
      { href: '/qr-codes', label: 'QR Codes', icon: QrCode },
      { href: '/qr-customization', label: 'QR Customization', icon: Palette },
    ],
  },
  {
    title: 'Verification',
    items: [
      { href: '/verification-history', label: 'History', icon: History },
      { href: '/ai-detection', label: 'AI Detection', icon: Bot },
    ],
  },
  {
    title: 'Security',
    items: [
      { href: '/fraud-intelligence', label: 'Fraud Intelligence', icon: Shield },
      { href: '/investigations', label: 'Investigations', icon: Search },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/domains', label: 'Domains', icon: Globe },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

function HopeLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-hope-primary/15" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-hope-primary text-[10px] font-black text-white">
          TM
        </div>
      </div>
      <div>
        <p className="text-base font-bold leading-tight text-hope-dark">TrueMark</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-hope-muted">Admin</p>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const rt = getRefreshToken();
    if (rt) {
      try {
        await api.logout(rt);
      } catch {
        /* best effort */
      }
    }
    clearAuth();
    clearSessionCache();
    router.push('/login');
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <HopeLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-hope-muted">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      onClick={onNavigate}
                      className={cn('hope-sidebar-link', active && 'hope-sidebar-link-active')}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {!active && <ChevronRight className="h-3.5 w-3.5 text-hope-muted opacity-0 group-hover:opacity-100" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-hope-body">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <HopeLogo />
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-6 w-6 text-hope-dark" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[270px] bg-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex">
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden w-[270px] border-r border-slate-100 bg-white md:block"
          style={{ boxShadow: 'var(--shadow-hope-sidebar)' }}
        >
          <Sidebar />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:ml-[270px]">
          <TopNavbar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            {loading ? (
              <div className="mx-auto max-w-[1400px] animate-pulse space-y-4">
                <div className="h-10 w-64 rounded-lg bg-slate-200" />
                <div className="h-4 w-96 rounded bg-slate-200" />
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="h-40 rounded-2xl bg-slate-200" />
                  <div className="h-40 rounded-2xl bg-slate-200" />
                  <div className="h-40 rounded-2xl bg-slate-200" />
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[1400px]">{children}</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
