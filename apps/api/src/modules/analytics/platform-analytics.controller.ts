import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { parseDateRange } from '../../common/utils/date-range.util';

@ApiTags('platform-analytics')
@ApiBearerAuth()
@Controller({ path: 'admin/platform/analytics', version: '1' })
export class PlatformAnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.PLATFORM_ADMIN)
  dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getPlatformDashboard(parseDateRange(from, to));
  }

  @Get('tenants/:tenantId/dashboard')
  @Roles(UserRole.PLATFORM_ADMIN)
  tenantDashboard(
    @Param('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getPlatformTenantDashboard(tenantId, parseDateRange(from, to));
  }
}
