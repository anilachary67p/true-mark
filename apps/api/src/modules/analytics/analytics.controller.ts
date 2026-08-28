import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { parseDateRange, parseDateRangeFromDates } from '../../common/utils/date-range.util';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.ANALYST, UserRole.READ_ONLY)
  dashboard(@TenantId() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getDashboard(tenantId, parseDateRange(from, to));
  }

  @Get('daily')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.ANALYST, UserRole.READ_ONLY)
  daily(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
  ) {
    if (!from && !to && days) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (parseInt(days, 10) - 1));
      return this.service.getDailyRollups(tenantId, parseDateRangeFromDates(start, end));
    }
    return this.service.getDailyRollups(tenantId, parseDateRange(from, to));
  }

  @Post('rollup')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN)
  rollup(@TenantId() tenantId: string) {
    return this.service.rollupDaily(tenantId, new Date());
  }
}
