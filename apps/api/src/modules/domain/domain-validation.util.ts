import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** Hostnames blocked from verification domain registration (policy). */
export const BLOCKED_VERIFICATION_HOSTNAMES = new Set([
  'localhost',
  'example.com',
  'example.org',
  'example.net',
  'test',
  'invalid',
]);

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const HOSTNAME_REGEX =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

export interface NormalizedCompanyDomain {
  url: string;
  hostname: string;
}

export interface NormalizedVerificationDomain {
  hostname: string;
  verificationPath: string;
}

export function normalizeCompanyDomainUrl(input: string): NormalizedCompanyDomain {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new BadRequestException('Invalid company domain URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Company domain must use HTTPS');
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException('Company domain URL must not contain credentials');
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new BadRequestException('Company domain URL must not include a path');
  }

  if (parsed.search || parsed.hash) {
    throw new BadRequestException('Company domain URL must not include query or fragment');
  }

  const hostname = parsed.hostname.toLowerCase();
  validateHostname(hostname, 'company domain');

  return { url: `https://${hostname}`, hostname };
}

export function normalizeVerificationHostname(input: string): string {
  let value = input.trim().toLowerCase();
  if (value.includes('://')) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') {
        throw new BadRequestException('Verification domain must use HTTPS when provided as URL');
      }
      value = parsed.hostname.toLowerCase();
    } catch {
      throw new BadRequestException('Invalid verification domain URL');
    }
  }
  value = value.split(':')[0];
  validateHostname(value, 'verification domain');
  assertVerificationHostnameAllowed(value);
  return value;
}

export function normalizeVerificationPath(input?: string): string {
  const path = (input ?? '/v').trim();
  if (!path.startsWith('/')) {
    throw new BadRequestException('Verification path must start with /');
  }
  if (path.includes('..') || path.includes('//')) {
    throw new BadRequestException('Verification path is invalid');
  }
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path === '' ? '/v' : path;
}

function validateHostname(hostname: string, label: string): void {
  if (!hostname || hostname.length > 253) {
    throw new BadRequestException(`Invalid ${label} hostname`);
  }
  if (IPV4_REGEX.test(hostname)) {
    throw new BadRequestException(`${label} must not be an IP address`);
  }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    throw new BadRequestException(`${label} uses a disallowed TLD`);
  }
  if (!HOSTNAME_REGEX.test(hostname)) {
    throw new BadRequestException(`Invalid ${label} hostname format`);
  }
}

export function assertVerificationHostnameAllowed(hostname: string): void {
  if (BLOCKED_VERIFICATION_HOSTNAMES.has(hostname)) {
    throw new BadRequestException(
      'This verification domain is not permitted by TrueMark domain policy',
    );
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new BadRequestException('localhost verification domains are not permitted');
  }
}

export function assertDomainStatusTransition(
  current: string,
  next: string,
  resourceLabel: string,
): void {
  const allowed: Record<string, string[]> = {
    PENDING: ['ACTIVE', 'DISABLED', 'REVOKED'],
    ACTIVE: ['SUSPENDED', 'REVOKED', 'DISABLED'],
    SUSPENDED: ['ACTIVE', 'REVOKED', 'DISABLED'],
    REVOKED: ['DISABLED'],
    DISABLED: [],
  };
  const permitted = allowed[current] ?? [];
  if (!permitted.includes(next)) {
    throw new BadRequestException(
      `Cannot transition ${resourceLabel} from ${current} to ${next}`,
    );
  }
}

export function assertTenantResourceAccess(
  resourceTenantId: string,
  requestTenantId: string,
): void {
  if (resourceTenantId !== requestTenantId) {
    throw new ForbiddenException('Access denied');
  }
}

export function tenantNotFound(): never {
  throw new NotFoundException('Tenant not found');
}

export function domainNotFound(): never {
  throw new NotFoundException('Domain not found');
}

export function duplicateDomain(message: string): never {
  throw new ConflictException(message);
}
