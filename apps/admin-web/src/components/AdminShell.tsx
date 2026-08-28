'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { clearAuth, getRefreshToken, api } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/organizations', label: 'Organizations' },
  { href: '/products', label: 'Products' },
  { href: '/qr-codes', label: 'QR Codes' },
  { href: '/qr-customization', label: 'QR Customization' },
  { href: '/verification-history', label: 'Verification History' },
  { href: '/ai-detection', label: 'AI Detection' },
  { href: '/fraud-intelligence', label: 'Fraud Intelligence' },
  { href: '/investigations', label: 'Investigations' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/domains', label: 'Domain Configuration' },
  { href: '/settings', label: 'Settings' },
  { href: '/audit-log', label: 'Audit Log' },
];

export function AdminShell({ children }: { children: ReactNode }) {
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
    router.push('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 240, background: '#1a1a2e', color: '#fff', padding: '1rem 0' }}>
        <div style={{ padding: '0 1rem 1rem', borderBottom: '1px solid #333' }}>
          <strong style={{ fontSize: 18 }}>TrueMark</strong>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Admin Portal</div>
        </div>
        <nav style={{ padding: '1rem 0' }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '0.5rem 1rem',
                color: pathname === item.href ? '#fff' : '#aaa',
                background: pathname === item.href ? '#2563eb33' : 'transparent',
                fontSize: 14,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} style={{ margin: '1rem', padding: '0.5rem 1rem', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: 4, width: 'calc(100% - 2rem)' }}>
          Sign Out
        </button>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem 2rem' }}>{children}</main>
    </div>
  );
}
