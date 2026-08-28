import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.ANALYST, UserRole.READ_ONLY)
  dashboard(@TenantId() tenantId: string) {
    return this.service.getDashboard(tenantId);
  }

  @Get('daily')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.ANALYST, UserRole.READ_ONLY)
  daily(@TenantId() tenantId: string, @Query('days') days?: string) {
    return this.service.getDailyRollups(tenantId, days ? parseInt(days, 10) : 30);
  }

  @Post('rollup')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  rollup(@TenantId() tenantId: string) {
    return this.service.rollupDaily(tenantId, new Date());
  }
}
