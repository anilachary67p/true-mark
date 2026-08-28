import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@truemark/db';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  function context(tenantId: string | undefined, user: object | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ params: { tenantId }, user }),
      }),
    } as ExecutionContext;
  }

  it('allows platform admin for any tenant', () => {
    const req = context('tenant-b', { roles: [UserRole.PLATFORM_ADMIN], tenantIds: [] });
    expect(guard.canActivate(req)).toBe(true);
  });

  it('allows tenant admin for assigned tenant', () => {
    const req = context('tenant-a', {
      roles: [UserRole.TENANT_ADMIN],
      tenantIds: ['tenant-a'],
    });
    expect(guard.canActivate(req)).toBe(true);
  });

  it('denies tenant admin for other tenant', () => {
    const req = context('tenant-b', {
      roles: [UserRole.TENANT_ADMIN],
      tenantIds: ['tenant-a'],
    });
    expect(() => guard.canActivate(req)).toThrow(ForbiddenException);
  });

  it('passes when tenantId param is absent', () => {
    const req = context(undefined, { roles: [UserRole.TENANT_ADMIN], tenantIds: ['tenant-a'] });
    expect(guard.canActivate(req)).toBe(true);
  });
});
