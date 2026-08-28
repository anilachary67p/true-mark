import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@truemark/db';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.params.tenantId ?? request.body?.tenantId;

    if (!tenantId) return true;

    if (user?.roles?.includes(UserRole.PLATFORM_ADMIN)) {
      request.tenantId = tenantId;
      return true;
    }

    if (!user?.tenantIds?.includes(tenantId)) {
      throw new ForbiddenException('Tenant access denied');
    }

    request.tenantId = tenantId;
    return true;
  }
}
