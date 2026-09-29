import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { QrCustomizationService } from './qr-customization.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { assertTenantObjectKey } from '../../providers/storage/storage-key.util';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

class QrConfigDto {
  @IsOptional() @IsInt() @Min(64) @Max(2048) width?: number;
  @IsOptional() @IsInt() @Min(0) @Max(16) quietZone?: number;
  @IsOptional() @IsString() @Matches(HEX_COLOR) foregroundColor?: string;
  @IsOptional() @IsString() @Matches(HEX_COLOR) backgroundColor?: string;
  @IsOptional() @IsIn(['L', 'M', 'Q', 'H']) errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  @IsOptional() @IsString() @MaxLength(512) logoObjectKey?: string;
  @IsOptional() @IsNumber() @Min(0.05) @Max(0.3) logoSizeRatio?: number;
}

class UpsertCustomizationDto {
  @ValidateNested()
  @Type(() => QrConfigDto)
  config!: QrConfigDto;

  @IsOptional()
  @IsIn(['tenant', 'category', 'product_type', 'variant', 'batch'])
  scope?: string;

  @IsOptional()
  @IsUUID()
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
    if (dto.config.logoObjectKey) assertTenantObjectKey(dto.config.logoObjectKey, tenantId);
    return this.service.upsert(
      tenantId,
      { ...dto.config } as Record<string, unknown>,
      user.id,
      dto.scope,
      dto.scopeId,
    );
  }
}
