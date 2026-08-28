import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { IsOptional, IsString } from 'class-validator';
import { VerificationHistoryService } from './verification-history.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/current-user.decorator';

class HistoryQueryDto {
  @IsOptional()
  @IsString()
  productUnitId?: string;

  @IsOptional()
  @IsString()
  result?: string;
}

const HISTORY_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.FRAUD_INVESTIGATOR,
  UserRole.ANALYST,
  UserRole.READ_ONLY,
] as const;

@ApiTags('verification-history')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/verification-history', version: '1' })
export class VerificationHistoryController {
  constructor(private readonly historyService: VerificationHistoryService) {}

  @Get()
  @Roles(...HISTORY_ROLES)
  list(
    @TenantId() tenantId: string,
    @Query() query: HistoryQueryDto,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.historyService.listForTenant(tenantId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      productUnitId: query.productUnitId,
      result: query.result,
    });
  }
}
