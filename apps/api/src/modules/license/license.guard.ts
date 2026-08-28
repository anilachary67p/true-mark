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
import { LicenseStatus } from '@truemark/shared';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { LICENSE_EXEMPT_KEY } from './license-exempt.decorator';
import { LicenseService } from './license.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get('SKIP_LICENSE_CHECK', { infer: true })) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isExempt = this.reflector.getAllAndOverride<boolean>(LICENSE_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isExempt) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined =
      request.params?.tenantId ?? request.user?.tenantIds?.[0] ?? request.user?.tenantId;

    if (!tenantId) return true;

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
}
