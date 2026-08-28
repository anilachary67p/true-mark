const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Tenant Admin',
  MANUFACTURER_ADMIN: 'Manufacturer Admin',
  PRODUCT_MANAGER: 'Product Manager',
  FRAUD_INVESTIGATOR: 'Fraud Investigator',
  ANALYST: 'Analyst',
  READ_ONLY: 'Read Only',
};

const ROLE_PRIORITY = [
  'PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'MANUFACTURER_ADMIN',
  'PRODUCT_MANAGER',
  'FRAUD_INVESTIGATOR',
  'ANALYST',
  'READ_ONLY',
] as const;

export function formatPrimaryRole(roles: string[]): string {
  if (!roles.length) return 'User';
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return ROLE_LABELS[role] ?? role;
  }
  return ROLE_LABELS[roles[0]] ?? roles[0].replace(/_/g, ' ');
}

export function formatRoleList(roles: string[]): string {
  if (!roles.length) return 'User';
  return roles.map((role) => ROLE_LABELS[role] ?? role.replace(/_/g, ' ')).join(', ');
}
