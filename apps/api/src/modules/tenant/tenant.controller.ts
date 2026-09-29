import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { TenantService } from './tenant.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CorrelationId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DeploymentType, TenantStatus } from '@truemark/db';
import { LicenseCommercialModel } from '@truemark/shared';
import { Request } from 'express';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CreateTenantDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsEnum(DeploymentType)
  deploymentType?: DeploymentType;

  @IsOptional()
  @IsEnum(LicenseCommercialModel)
  commercialModel?: LicenseCommercialModel;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3650)
  licenseValidDays?: number;
}

class UpdateTenantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsEnum(DeploymentType)
  deploymentType?: DeploymentType;
}

class UpdateTenantProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  companyDisplayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@ApiTags('tenants')
@ApiBearerAuth()
@Controller({ path: 'admin/tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.tenantService.create(dto, user.id, correlationId, req.ip);
  }

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  findAll(@CurrentUser() user: AuthUser) {
    return this.tenantService.findAll(user.roles, user.tenantIds);
  }

  @Get(':tenantId')
  @UseGuards(TenantGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  findOne(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.tenantService.findOne(tenantId, user.roles, user.tenantIds);
  }

  @Get(':tenantId/configuration')
  @UseGuards(TenantGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  getConfiguration(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.tenantService.getConfiguration(tenantId, user.roles, user.tenantIds);
  }

  @Patch(':tenantId')
  @UseGuards(TenantGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  update(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.tenantService.update(
      tenantId,
      dto,
      user.id,
      user.roles,
      user.tenantIds,
      correlationId,
      req.ip,
    );
  }

  @Patch(':tenantId/profile')
  @UseGuards(TenantGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  updateProfile(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.tenantService.updateProfile(
      tenantId,
      dto,
      user.id,
      user.roles,
      user.tenantIds,
      correlationId,
      req.ip,
    );
  }
}
