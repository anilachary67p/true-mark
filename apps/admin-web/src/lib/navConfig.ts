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
  Bell,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { isPlatformAdminRole } from './roleAccess';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

const PLATFORM_NAV: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      { href: '/dashboard', label: 'Platform Dashboard', icon: LayoutDashboard },
      { href: '/organizations', label: 'Organizations', icon: Building2 },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings/notifications', label: 'Notification', icon: Bell },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/settings/config', label: 'Config', icon: SlidersHorizontal },
    ],
  },
];

const TENANT_NAV: NavGroup[] = [
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

export function getNavGroups(roles: string[]): NavGroup[] {
  return isPlatformAdminRole(roles) ? PLATFORM_NAV : TENANT_NAV;
}
