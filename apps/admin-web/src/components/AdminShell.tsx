'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearAuth, getRefreshToken, api } from '@/lib/api';
import { clearSessionCache, useSession } from '@/providers/SessionProvider';
import { getNavGroups } from '@/lib/navConfig';
import { isPlatformAdminRole } from '@/lib/roleAccess';
import { TopNavbar } from '@/components/TopNavbar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/settings') return false;
  return pathname.startsWith(`${href}/`);
}

import { LogOut, Menu, X, ChevronRight } from 'lucide-react';

function HopeLogo({ subtitle = 'Admin' }: { subtitle?: string }) {
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
        <p className="text-[10px] font-medium uppercase tracking-wider text-hope-muted">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userEmail, roleLabel, roles } = useSession();
  const navGroups = getNavGroups(roles);
  const subtitle = isPlatformAdminRole(roles) ? 'Platform' : 'Tenant';

  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
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
    router.replace('/login');
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <HopeLogo subtitle={subtitle} />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-hope-muted">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item.href);
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
                      {!active && (
                        <ChevronRight className="h-3.5 w-3.5 text-hope-muted opacity-0 group-hover:opacity-100" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        {userEmail && (
          <div className="mb-3 rounded-xl bg-hope-body px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-hope-dark">{userEmail}</p>
            <p className="text-[10px] font-medium text-hope-primary">{roleLabel}</p>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={logout}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </Button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, roles, error: sessionError, retry } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const subtitle = isPlatformAdminRole(roles) ? 'Platform' : 'Tenant';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-hope-body">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <HopeLogo subtitle={subtitle} />
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-6 w-6 text-hope-dark" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[270px] bg-white shadow-xl">
            <button
              type="button"
              aria-label="Close menu"
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
            ) : sessionError ? (
              <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
                <p className="text-lg font-semibold text-hope-dark">We couldn&apos;t load your workspace</p>
                <p className="mt-2 text-sm text-hope-secondary">{sessionError}</p>
                <Button className="mt-5" onClick={retry}>
                  Try again
                </Button>
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
