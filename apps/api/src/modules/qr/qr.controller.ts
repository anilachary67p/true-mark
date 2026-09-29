import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LifecycleStatus, UserRole } from '@truemark/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QrService } from './qr.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { parsePagination } from '../../common/utils/pagination.util';

const EXPORT_FORMATS = ['PNG', 'SVG', 'ZIP'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

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
    const page = parsePagination(limit, offset, { defaultLimit: 100, maxLimit: 500 });
    return this.qrService.listByTenant(tenantId, page.take, page.skip);
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
    @Query('format') format: string = 'PNG',
    @Query('limit') limit?: string,
  ) {
    if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
      throw new BadRequestException(`format must be one of ${EXPORT_FORMATS.join(', ')}`);
    }
    const { take } = parsePagination(limit, undefined, { defaultLimit: 100, maxLimit: 500 });
    return this.qrService.exportBatch(tenantId, batchId, format as ExportFormat, take);
  }

  @Post(':qrCodeId/export')
  @Roles(...QR_ROLES)
  export(
    @TenantId() tenantId: string,
    @Param('qrCodeId') qrCodeId: string,
    @Query('format') format: string = 'PNG',
  ) {
    if (format !== 'PNG' && format !== 'SVG') {
      throw new BadRequestException('format must be PNG or SVG');
    }
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
