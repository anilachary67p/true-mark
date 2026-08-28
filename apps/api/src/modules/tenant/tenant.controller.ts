import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { TenantService } from './tenant.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CorrelationId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { DeploymentType, TenantStatus } from '@truemark/db';
import { LicenseCommercialModel } from '@truemark/shared';
import { Request } from 'express';

class CreateTenantDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
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
  licenseValidDays?: number;
}

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  companyDisplayName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEmail()
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
