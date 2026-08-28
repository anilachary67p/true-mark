import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiMode, UserRole } from '@truemark/db';
import { IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { AiConfigService } from './ai-config.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';

class UpdateAiConfigDto {
  @IsOptional()
  @IsEnum(AiMode)
  mode?: AiMode;

  @IsOptional()
  @IsInt()
  quota?: number;

  @IsOptional()
  @IsObject()
  config?: object;
}

class CreateReferenceDataDto {
  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsObject()
  metadata?: object;
}

const AI_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.PRODUCT_MANAGER,
] as const;

@ApiTags('ai-config')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/ai-config', version: '1' })
export class AiConfigController {
  constructor(private readonly service: AiConfigService) {}

  @Get()
  @Roles(...AI_ROLES)
  async get(@TenantId() tenantId: string) {
    const config = await this.service.get(tenantId);
    const usage = await this.service.getUsageCount(tenantId);
    return { ...config, usage };
  }

  @Patch()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  update(
    @TenantId() tenantId: string,
    @Body() dto: UpdateAiConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(tenantId, dto, user.id);
  }
}

@ApiTags('reference-data')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/reference-data', version: '1' })
export class ReferenceDataController {
  constructor(private readonly service: AiConfigService) {}

  @Get()
  @Roles(...AI_ROLES)
  async list(@TenantId() tenantId: string) {
    const config = await this.service.get(tenantId);
    return config?.referenceData ?? [];
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateReferenceDataDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createReferenceData(tenantId, dto, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  delete(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteReferenceData(tenantId, id, user.id);
  }
}
