import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, VerificationResult } from '@truemark/db';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { VerificationHistoryService } from './verification-history.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/current-user.decorator';
import { parseDateRange } from '../../common/utils/date-range.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

class HistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  productUnitId?: string;

  @IsOptional()
  @IsEnum(VerificationResult)
  result?: VerificationResult;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
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
  list(@TenantId() tenantId: string, @Query() query: HistoryQueryDto) {
    const range =
      query.from || query.to ? parseDateRange(query.from, query.to, 365) : undefined;

    return this.historyService.listForTenant(tenantId, {
      limit: Math.min(query.limit ?? 50, 200),
      offset: query.offset ?? 0,
      productUnitId: query.productUnitId,
      result: query.result,
      from: range?.from,
      to: range?.to,
    });
  }
}
