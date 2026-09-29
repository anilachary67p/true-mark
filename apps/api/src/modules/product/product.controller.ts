import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { parsePagination } from '../../common/utils/pagination.util';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LifecycleStatus, UserRole } from '@truemark/db';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
import { ProductService } from './product.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

class CreateProductTypeDto {
  @IsUUID()
  categoryId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

class CreateVariantDto {
  @IsUUID()
  productTypeId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

class CreateBatchDto {
  @IsUUID()
  productVariantId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  batchCode!: string;

  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

class BulkGenerateDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,16}$/, { message: 'serialPrefix must be 1-16 letters, digits or dashes' })
  serialPrefix?: string;
}

class UpdateStatusDto {
  @IsEnum(LifecycleStatus)
  status!: LifecycleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

const PRODUCT_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.MANUFACTURER_ADMIN,
  UserRole.PRODUCT_MANAGER,
] as const;

const READ_ROLES = [
  ...PRODUCT_ROLES,
  UserRole.ANALYST,
  UserRole.READ_ONLY,
] as const;

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'admin/tenants/:tenantId', version: '1' })
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    @InjectQueue('bulk-generation') private readonly bulkQueue: Queue,
  ) {}

  @Get('categories')
  @Roles(...READ_ROLES)
  listCategories(@TenantId() tenantId: string) {
    return this.productService.listCategories(tenantId);
  }

  @Post('categories')
  @Roles(...PRODUCT_ROLES)
  createCategory(@TenantId() tenantId: string, @Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.productService.createCategory(tenantId, dto.name, user.id);
  }

  @Get('product-types')
  @Roles(...READ_ROLES)
  listProductTypes(@TenantId() tenantId: string, @Query('categoryId') categoryId?: string) {
    return this.productService.listProductTypes(tenantId, categoryId);
  }

  @Get('product-types/:productTypeId')
  @Roles(...READ_ROLES)
  getProductType(@TenantId() tenantId: string, @Param('productTypeId') productTypeId: string) {
    return this.productService.getProductType(tenantId, productTypeId);
  }

  @Post('product-types')
  @Roles(...PRODUCT_ROLES)
  createProductType(@TenantId() tenantId: string, @Body() dto: CreateProductTypeDto, @CurrentUser() user: AuthUser) {
    return this.productService.createProductType(tenantId, dto.categoryId, dto.name, user.id);
  }

  @Patch('product-types/:productTypeId/status')
  @Roles(...PRODUCT_ROLES)
  updateProductTypeStatus(
    @TenantId() tenantId: string,
    @Param('productTypeId') productTypeId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateProductTypeStatus(
      tenantId,
      productTypeId,
      dto.status,
      user.id,
      dto.reason,
    );
  }

  @Get('variants')
  @Roles(...READ_ROLES)
  listVariants(
    @TenantId() tenantId: string,
    @Query('tag') tag?: string,
    @Query('productTypeId') productTypeId?: string,
  ) {
    return this.productService.listVariants(tenantId, { tag, productTypeId });
  }

  @Get('variants/:variantId')
  @Roles(...READ_ROLES)
  getVariant(@TenantId() tenantId: string, @Param('variantId') variantId: string) {
    return this.productService.getVariant(tenantId, variantId);
  }

  @Post('variants')
  @Roles(...PRODUCT_ROLES)
  createVariant(@TenantId() tenantId: string, @Body() dto: CreateVariantDto, @CurrentUser() user: AuthUser) {
    return this.productService.createVariant(tenantId, dto.productTypeId, dto.name, user.id, dto.tags);
  }

  @Patch('variants/:variantId/status')
  @Roles(...PRODUCT_ROLES)
  updateVariantStatus(
    @TenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateVariantStatus(tenantId, variantId, dto.status, user.id, dto.reason);
  }

  @Get('tags')
  @Roles(...READ_ROLES)
  listTags(@TenantId() tenantId: string) {
    return this.productService.listTags(tenantId);
  }

  @Get('catalog-stats')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.TENANT_ADMIN, UserRole.ANALYST, UserRole.READ_ONLY)
  getCatalogStats(@TenantId() tenantId: string) {
    return this.productService.getCatalogStats(tenantId);
  }

  @Get('batches')
  @Roles(...READ_ROLES)
  listBatches(@TenantId() tenantId: string, @Query('variantId') variantId?: string) {
    return this.productService.listBatches(tenantId, variantId);
  }

  @Get('batches/:batchId')
  @Roles(...READ_ROLES)
  getBatch(@TenantId() tenantId: string, @Param('batchId') batchId: string) {
    return this.productService.getBatch(tenantId, batchId);
  }

  @Post('batches')
  @Roles(...PRODUCT_ROLES)
  createBatch(@TenantId() tenantId: string, @Body() dto: CreateBatchDto, @CurrentUser() user: AuthUser) {
    return this.productService.createBatch(
      tenantId,
      dto.productVariantId,
      dto.batchCode,
      {
        manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
      user.id,
    );
  }

  @Patch('batches/:batchId/status')
  @Roles(...PRODUCT_ROLES)
  updateBatchStatus(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateBatchStatus(tenantId, batchId, dto.status, user.id, dto.reason);
  }

  @Post('batches/:batchId/generate-units')
  @Roles(...PRODUCT_ROLES)
  generateUnits(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @Body() dto: BulkGenerateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.startUnitGeneration(
      tenantId,
      batchId,
      dto.quantity,
      dto.serialPrefix ?? 'ABC',
      user.id,
      async (payload) => {
        await this.bulkQueue.add('generate-units', payload);
      },
    );
  }

  @Get('batches/:batchId/units')
  @Roles(...READ_ROLES)
  listUnits(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const page = parsePagination(limit, offset, { defaultLimit: 100, maxLimit: 500 });
    return this.productService.listUnits(batchId, tenantId, page.take, page.skip);
  }

  @Patch('product-units/:unitId/status')
  @Roles(...PRODUCT_ROLES)
  updateUnitStatus(
    @TenantId() tenantId: string,
    @Param('unitId') unitId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateProductUnitStatus(tenantId, unitId, dto.status, user.id);
  }

  @Get('bulk-jobs/:jobId')
  @Roles(...PRODUCT_ROLES)
  getBulkJob(@TenantId() tenantId: string, @Param('jobId') jobId: string) {
    return this.productService.getBulkJob(tenantId, jobId);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@Controller({ path: 'admin/platform', version: '1' })
export class PlatformCatalogController {
  constructor(private readonly productService: ProductService) {}

  @Get('overview')
  @Roles(UserRole.PLATFORM_ADMIN)
  getOverview() {
    return this.productService.getPlatformOverview();
  }
}
