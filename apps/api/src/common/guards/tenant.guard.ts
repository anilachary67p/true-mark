import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@truemark/db';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the tenant for tenant-scoped routes from the `:tenantId` path parameter only.
 * Fails closed: a route guarded by TenantGuard without a tenant id is rejected.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId: string | undefined = request.params?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    if (!UUID_PATTERN.test(tenantId)) {
      throw new BadRequestException('Invalid tenant id');
    }

    const isPlatformAdmin =
      user?.globalRoles?.includes(UserRole.PLATFORM_ADMIN) ??
      user?.roles?.includes(UserRole.PLATFORM_ADMIN);

    if (!isPlatformAdmin && !user?.tenantIds?.includes(tenantId)) {
      throw new ForbiddenException('Tenant access denied');
    }

    request.tenantId = tenantId;
    return true;
  }
}
