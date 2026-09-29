import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvestigationStatus, UserRole } from '@truemark/db';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { InvestigationService } from './investigation.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';

class CreateInvestigationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

class UpdateStatusDto {
  @IsEnum(InvestigationStatus)
  status!: InvestigationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

@ApiTags('investigations')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/investigations', version: '1' })
export class InvestigationController {
  constructor(private readonly service: InvestigationService) {}

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  list(@TenantId() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  create(@TenantId() tenantId: string, @Body() dto: CreateInvestigationDto, @CurrentUser() user: AuthUser) {
    return this.service.create(tenantId, dto.title, dto.description, user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.FRAUD_INVESTIGATOR)
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, tenantId, dto.status, dto.note, user.id);
  }
}
