import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LifecycleStatus, UserRole } from '@truemark/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QrService } from './qr.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';

class UpdateQrStatusDto {
  @IsEnum(LifecycleStatus)
  status!: LifecycleStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

const QR_ROLES = [UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.PRODUCT_MANAGER] as const;

@ApiTags('qr')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId/qr', version: '1' })
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get()
  @Roles(...QR_ROLES)
  list(
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.qrService.listByTenant(
      tenantId,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('preview')
  @Roles(...QR_ROLES)
  preview(@TenantId() tenantId: string) {
    return this.qrService.preview(tenantId);
  }

  @Post('batches/:batchId/generate')
  @Roles(...QR_ROLES)
  generateForBatch(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qrService.generateMissingForBatch(tenantId, batchId, user.id);
  }

  @Post('batches/:batchId/export')
  @Roles(...QR_ROLES)
  exportBatch(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @Query('format') format: 'PNG' | 'SVG' | 'ZIP' = 'PNG',
    @Query('limit') limit?: string,
  ) {
    return this.qrService.exportBatch(tenantId, batchId, format, limit ? parseInt(limit, 10) : 100);
  }

  @Post(':qrCodeId/export')
  @Roles(...QR_ROLES)
  export(
    @TenantId() tenantId: string,
    @Param('qrCodeId') qrCodeId: string,
    @Query('format') format: 'PNG' | 'SVG' = 'PNG',
  ) {
    return this.qrService.exportQr(qrCodeId, tenantId, format);
  }

  @Patch(':qrCodeId/status')
  @Roles(...QR_ROLES)
  updateStatus(
    @TenantId() tenantId: string,
    @Param('qrCodeId') qrCodeId: string,
    @Body() dto: UpdateQrStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qrService.updateStatus(tenantId, qrCodeId, dto.status, user.id, dto.reason);
  }
}
