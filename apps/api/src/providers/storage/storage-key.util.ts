import { BadRequestException } from '@nestjs/common';

const SAFE_KEY = /^[A-Za-z0-9/_.-]{1,512}$/;

/** Rejects traversal, absolute paths and unexpected characters in object keys. */
export function assertSafeObjectKey(key: string): void {
  if (
    typeof key !== 'string' ||
    !SAFE_KEY.test(key) ||
    key.startsWith('/') ||
    key.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
  ) {
    throw new BadRequestException('Invalid object key');
  }
}

/** Ensures an object key belongs to the given tenant's namespace (`tenants/<tenantId>/...`). */
export function assertTenantObjectKey(key: string, tenantId: string): void {
  assertSafeObjectKey(key);
  if (!key.startsWith(`tenants/${tenantId}/`)) {
    throw new BadRequestException('Object key does not belong to this tenant');
  }
}
