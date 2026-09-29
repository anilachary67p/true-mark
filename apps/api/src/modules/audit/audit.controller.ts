import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@truemark/db';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { parseDateRange } from '../../common/utils/date-range.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.READ_ONLY)
  list(@TenantId() tenantId: string, @Query() query: AuditQueryDto) {
    const range =
      query.from || query.to ? parseDateRange(query.from, query.to, 366) : undefined;

    return this.auditService.listForTenant(tenantId, {
      limit: Math.min(query.limit ?? 50, 200),
      offset: query.offset ?? 0,
      action: query.action,
      resourceType: query.resourceType,
      userId: query.userId,
      from: range?.from,
      to: range?.to,
    });
  }
}
