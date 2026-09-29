/** `/domains` is reachable (not in nav) so platform admins can manage a tenant's domains from Organizations. */
export const PLATFORM_ADMIN_PATHS = new Set(['/dashboard', '/organizations', '/settings', '/domains']);

export const PLATFORM_ADMIN_SETTINGS_PATHS = new Set([
  '/settings',
  '/settings/notifications',
  '/settings/config',
]);

export const PLATFORM_ADMIN_ONLY_PATHS = new Set(['/settings/notifications', '/settings/config']);

export const TENANT_ADMIN_BLOCKED_PATHS = new Set([
  '/organizations',
  '/settings/notifications',
  '/settings/config',
]);

export function isPlatformAdminRole(roles: string[]): boolean {
  return roles.includes('PLATFORM_ADMIN');
}

function resolvePathSegments(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const root = `/${segments[0] ?? 'dashboard'}`;
  const nested = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : root;
  return { root, nested };
}

export function canAccessPath(pathname: string, roles: string[]): boolean {
  if (roles.length === 0) return false;
  const { root, nested } = resolvePathSegments(pathname);

  if (isPlatformAdminRole(roles)) {
    if (root === '/settings') {
      return PLATFORM_ADMIN_SETTINGS_PATHS.has(nested);
    }
    return PLATFORM_ADMIN_PATHS.has(root);
  }

  if (PLATFORM_ADMIN_ONLY_PATHS.has(nested)) {
    return false;
  }

  return !TENANT_ADMIN_BLOCKED_PATHS.has(root);
}

export function defaultHomePath(roles: string[]): string {
  return '/dashboard';
}
