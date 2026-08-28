import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { LicenseCommercialModel } from '@truemark/shared';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { LicenseService } from './license.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { LicenseExempt } from './license-exempt.decorator';
import { AuthUser } from '../auth/auth.service';

class GenerateLicenseDto {
  @IsUUID()
  tenantId!: string;

  @IsEnum(LicenseCommercialModel)
  commercialModel!: LicenseCommercialModel;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsString()
  productOwnerEmail?: string;

  @IsOptional()
  @IsString()
  productOwnerPhone?: string;
}

class RenewLicenseDto {
  @IsDateString()
  validUntil!: string;
}

class InstallLicenseDto {
  @IsString()
  licenseFile!: string;
}

@ApiTags('license')
@ApiBearerAuth()
@Controller({ version: '1' })
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @LicenseExempt()
  @UseGuards(TenantGuard)
  @Get('admin/tenants/:tenantId/license/status')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.ANALYST,
    UserRole.READ_ONLY,
    UserRole.FRAUD_INVESTIGATOR,
    UserRole.PRODUCT_MANAGER,
  )
  status(@TenantId() tenantId: string) {
    return this.licenseService.getTenantLicenseStatus(tenantId);
  }

  @LicenseExempt()
  @Post('admin/platform/licenses/generate')
  @Roles(UserRole.PLATFORM_ADMIN)
  generate(@Body() dto: GenerateLicenseDto) {
    return this.licenseService.issueLicenseForTenant(dto);
  }

  @LicenseExempt()
  @Post('admin/platform/licenses/:tenantId/renew')
  @Roles(UserRole.PLATFORM_ADMIN)
  renew(@Param('tenantId') tenantId: string, @Body() dto: RenewLicenseDto) {
    return this.licenseService.renewLicense(tenantId, new Date(dto.validUntil));
  }

  @LicenseExempt()
  @Post('admin/platform/licenses/install')
  @Roles(UserRole.PLATFORM_ADMIN)
  install(@Body() dto: InstallLicenseDto) {
    return this.licenseService.installLicenseFile(dto.licenseFile);
  }

  @LicenseExempt()
  @Get('admin/platform/licenses')
  @Roles(UserRole.PLATFORM_ADMIN)
  list() {
    return this.licenseService.listLicenses();
  }

  @LicenseExempt()
  @Post('admin/platform/licenses/validate-all')
  @Roles(UserRole.PLATFORM_ADMIN)
  validateAll(@CurrentUser() _user: AuthUser) {
    return this.licenseService.validateAllTenants('manual');
  }
}
