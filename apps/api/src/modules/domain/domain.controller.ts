import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DomainStatus, UserRole } from '@truemark/db';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Request } from 'express';
import { DomainService } from './domain.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CorrelationId, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';

class CreateCompanyDomainDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url!: string;
}

class CreateVerificationDomainDto {
  @IsString()
  @MaxLength(253)
  hostname!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  verificationPath?: string;

  @IsOptional()
  @IsBoolean()
  setPrimary?: boolean;
}

class UpdateDomainStatusDto {
  @IsEnum(DomainStatus)
  status!: DomainStatus;
}

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/domains', version: '1' })
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  getConfiguration(@TenantId() tenantId: string) {
    return this.domainService.getTenantDomainConfiguration(tenantId);
  }

  @Get('company')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  listCompany(@TenantId() tenantId: string) {
    return this.domainService.listCompanyDomains(tenantId);
  }

  @Post('company')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  createCompany(
    @TenantId() tenantId: string,
    @Body() dto: CreateCompanyDomainDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.createCompanyDomain(
      tenantId,
      dto.url,
      user.id,
      correlationId,
      req.ip,
    );
  }

  @Patch('company/:domainId/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  updateCompanyStatus(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @Body() dto: UpdateDomainStatusDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.updateCompanyDomainStatus(
      tenantId,
      domainId,
      dto.status,
      user.id,
      correlationId,
      req.ip,
    );
  }

  @Post('company/:domainId/activate')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  activateCompany(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.activateCompanyDomain(
      tenantId,
      domainId,
      user.id,
      correlationId,
      req.ip,
    );
  }

  @Get('verification')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  listVerification(@TenantId() tenantId: string) {
    return this.domainService.listVerificationDomains(tenantId);
  }

  @Post('verification')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  createVerification(
    @TenantId() tenantId: string,
    @Body() dto: CreateVerificationDomainDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.createVerificationDomain(
      tenantId,
      dto.hostname,
      dto.verificationPath,
      user.id,
      correlationId,
      req.ip,
      dto.setPrimary ?? false,
    );
  }

  @Get('verification/:domainId/challenge')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  getChallenge(@TenantId() tenantId: string, @Param('domainId') domainId: string) {
    return this.domainService.getVerificationChallenge(tenantId, domainId);
  }

  @Post('verification/:domainId/verify')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  verify(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.verifyDomain(tenantId, domainId, user.id, correlationId, req.ip);
  }

  @Post('verification/:domainId/challenge/refresh')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  refreshChallenge(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.refreshVerificationChallenge(
      tenantId,
      domainId,
      user.id,
      correlationId,
      req.ip,
    );
  }

  @Patch('verification/:domainId/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  updateVerificationStatus(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @Body() dto: UpdateDomainStatusDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.updateVerificationDomainStatus(
      tenantId,
      domainId,
      dto.status,
      user.id,
      correlationId,
      req.ip,
      user.globalRoles?.includes(UserRole.PLATFORM_ADMIN) ?? false,
    );
  }

  @Post('verification/:domainId/primary')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  setPrimary(
    @TenantId() tenantId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.domainService.setPrimaryVerificationDomain(
      tenantId,
      domainId,
      user.id,
      correlationId,
      req.ip,
    );
  }
}
