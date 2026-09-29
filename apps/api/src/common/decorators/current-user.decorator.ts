import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.correlationId;
  },
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.tenantId) {
      // Never fall back to an arbitrary tenant: an unscoped query could span all tenants.
      throw new InternalServerErrorException('Tenant context missing — route must use TenantGuard');
    }
    return request.tenantId as string;
  },
);
