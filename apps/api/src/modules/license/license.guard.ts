import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EnvConfig } from '@truemark/config';
import { TenantStatus, UserRole } from '@truemark/db';
import { LicenseStatus } from '@truemark/shared';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { LICENSE_EXEMPT_KEY } from './license-exempt.decorator';
import { LicenseService } from './license.service';
import { PrismaService } from '../../providers/prisma.service';
import type { AuthUser } from '../auth/auth.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_STATUS_TTL_MS = 15_000;
const BLOCKED_TENANT_STATUSES: TenantStatus[] = [TenantStatus.SUSPENDED, TenantStatus.DISABLED];

/**
 * Enforces, for tenant-scoped admin routes:
 * 1. the tenant is not SUSPENDED / DISABLED (platform admins are exempt so they can remediate);
 * 2. the tenant holds a valid license (unless the route is @LicenseExempt()).
 * Tenant membership itself is enforced by TenantGuard; this guard never reveals status for
 * tenants the caller does not belong to.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly tenantStatusCache = new Map<string, { status: TenantStatus; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
    private readonly config: ConfigService<EnvConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.params?.tenantId;
    if (!tenantId || !UUID_PATTERN.test(tenantId)) return true;

    const user: AuthUser | undefined = request.user;
    const isPlatformAdmin =
      user?.globalRoles?.includes(UserRole.PLATFORM_ADMIN) ??
      user?.roles?.includes(UserRole.PLATFORM_ADMIN) ??
      false;
    if (!isPlatformAdmin && !user?.tenantIds?.includes(tenantId)) return true;

    if (!isPlatformAdmin) {
      const tenantStatus = await this.getTenantStatus(tenantId);
      if (tenantStatus && BLOCKED_TENANT_STATUSES.includes(tenantStatus)) {
        throw new ForbiddenException({
          code: 'TENANT_SUSPENDED',
          message: 'This organization is suspended. Contact the platform administrator.',
        });
      }
    }

    const isExempt = this.reflector.getAllAndOverride<boolean>(LICENSE_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isExempt || this.config.get('SKIP_LICENSE_CHECK', { infer: true })) return true;

    const status = await this.licenseService.getTenantLicenseStatus(tenantId);
    if (status.status === LicenseStatus.BLOCKED || status.status === LicenseStatus.MISSING) {
      throw new ServiceUnavailableException({
        code: 'LICENSE_BLOCKED',
        message: 'License renewal required. Contact the product owner.',
        status,
      });
    }

    if (status.status === LicenseStatus.INVALID) {
      throw new ForbiddenException({
        code: 'LICENSE_INVALID',
        message: status.message ?? 'License is invalid or tampered',
      });
    }

    return true;
  }

  private async getTenantStatus(tenantId: string): Promise<TenantStatus | null> {
    const now = Date.now();
    const cached = this.tenantStatusCache.get(tenantId);
    if (cached && cached.expiresAt > now) return cached.status;

    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant) return null;

    if (this.tenantStatusCache.size > 10_000) this.tenantStatusCache.clear();
    this.tenantStatusCache.set(tenantId, { status: tenant.status, expiresAt: now + TENANT_STATUS_TTL_MS });
    return tenant.status;
  }
}
