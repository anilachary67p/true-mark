import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { QrCustomizationService } from './qr-customization.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { IsObject, IsOptional, IsString } from 'class-validator';

class UpsertCustomizationDto {
  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  scopeId?: string;
}

@ApiTags('qr-customization')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/qr-customization', version: '1' })
export class QrCustomizationController {
  constructor(private readonly service: QrCustomizationService) {}

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.PRODUCT_MANAGER)
  async get(@TenantId() tenantId: string) {
    const active = await this.service.getActive(tenantId);
    return active ?? { config: null, version: 0 };
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.PRODUCT_MANAGER)
  upsert(
    @TenantId() tenantId: string,
    @Body() dto: UpsertCustomizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.upsert(tenantId, dto.config, user.id, dto.scope, dto.scopeId);
  }
}
