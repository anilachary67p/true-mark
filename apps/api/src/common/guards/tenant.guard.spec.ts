import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@truemark/db';
import { TenantGuard } from './tenant.guard';
import { RolesGuard } from './roles.guard';

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';

function context(tenantId: string | undefined, user: object | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ params: { tenantId }, user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('allows platform admin for any tenant', () => {
    const req = context(TENANT_B, {
      roles: [UserRole.PLATFORM_ADMIN],
      globalRoles: [UserRole.PLATFORM_ADMIN],
      tenantIds: [],
    });
    expect(guard.canActivate(req)).toBe(true);
  });

  it('allows tenant admin for assigned tenant', () => {
    const req = context(TENANT_A, { roles: [UserRole.TENANT_ADMIN], tenantIds: [TENANT_A] });
    expect(guard.canActivate(req)).toBe(true);
  });

  it('denies tenant admin for other tenant', () => {
    const req = context(TENANT_B, { roles: [UserRole.TENANT_ADMIN], tenantIds: [TENANT_A] });
    expect(() => guard.canActivate(req)).toThrow(ForbiddenException);
  });

  it('fails closed when tenantId param is absent', () => {
    const req = context(undefined, { roles: [UserRole.TENANT_ADMIN], tenantIds: [TENANT_A] });
    expect(() => guard.canActivate(req)).toThrow(ForbiddenException);
  });

  it('rejects malformed tenant ids', () => {
    const req = context('../platform', { roles: [UserRole.PLATFORM_ADMIN], tenantIds: [] });
    expect(() => guard.canActivate(req)).toThrow(BadRequestException);
  });

  it('does not treat a tenant-scoped PLATFORM_ADMIN row as global', () => {
    const req = context(TENANT_B, {
      roles: [UserRole.PLATFORM_ADMIN],
      globalRoles: [],
      rolesByTenant: { [TENANT_A]: [UserRole.PLATFORM_ADMIN] },
      tenantIds: [TENANT_A],
    });
    expect(() => guard.canActivate(req)).toThrow(ForbiddenException);
  });
});

describe('RolesGuard (per-tenant roles)', () => {
  function guardRequiring(roles: UserRole[]) {
    const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  const multiTenantUser = {
    id: 'u1',
    email: 'u@example.com',
    roles: [UserRole.TENANT_ADMIN, UserRole.READ_ONLY],
    tenantIds: [TENANT_A, TENANT_B],
    globalRoles: [],
    rolesByTenant: { [TENANT_A]: [UserRole.TENANT_ADMIN], [TENANT_B]: [UserRole.READ_ONLY] },
  };

  it('grants admin actions in the tenant where the user is admin', () => {
    expect(guardRequiring([UserRole.TENANT_ADMIN]).canActivate(context(TENANT_A, multiTenantUser))).toBe(
      true,
    );
  });

  it('denies admin actions in a tenant where the user is only read-only', () => {
    expect(() =>
      guardRequiring([UserRole.TENANT_ADMIN]).canActivate(context(TENANT_B, multiTenantUser)),
    ).toThrow(ForbiddenException);
  });

  it('honours global platform admin role in any tenant', () => {
    const admin = {
      ...multiTenantUser,
      roles: [UserRole.PLATFORM_ADMIN],
      globalRoles: [UserRole.PLATFORM_ADMIN],
      rolesByTenant: {},
      tenantIds: [],
    };
    expect(guardRequiring([UserRole.PLATFORM_ADMIN]).canActivate(context(TENANT_B, admin))).toBe(true);
  });
});
