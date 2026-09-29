import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { FraudService } from './fraud.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

class UpdateFraudConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  highScanCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(43_200)
  highScanWindowMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5_000)
  maxTravelSpeedKmh?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(43_200)
  impossibleTravelMinutes?: number;
}

@ApiTags('fraud')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/fraud', version: '1' })
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('config')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  config(@TenantId() tenantId: string) {
    return this.fraudService.getConfig(tenantId);
  }

  @Patch('config')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  updateConfig(@TenantId() tenantId: string, @Body() dto: UpdateFraudConfigDto) {
    return this.fraudService.updateConfig(tenantId, dto);
  }

  @Get('signals')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  signals(@TenantId() tenantId: string) {
    return this.fraudService.getSignals(tenantId);
  }

  @Get('hotspots')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.FRAUD_INVESTIGATOR,
    UserRole.ANALYST,
  )
  hotspots(@TenantId() tenantId: string) {
    return this.fraudService.getHotspots(tenantId);
  }

  @Get('summary')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.FRAUD_INVESTIGATOR,
    UserRole.ANALYST,
  )
  summary(@TenantId() tenantId: string) {
    return this.fraudService.getSummary(tenantId);
  }

  @Get('alerts')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  alerts(@TenantId() tenantId: string) {
    return this.fraudService.getAlerts(tenantId);
  }
}
