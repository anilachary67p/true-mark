import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LifecycleStatus, UserRole } from '@truemark/db';
import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsEnum } from 'class-validator';
import { ProductService } from './product.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser } from '../auth/auth.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

class CreateManufacturerDto {
  @IsString()
  name!: string;
}

class CreateBrandDto {
  @IsString()
  manufacturerId!: string;

  @IsString()
  name!: string;
}

class CreateProductDto {
  @IsString()
  brandId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;
}

class CreateVariantDto {
  @IsString()
  productId!: string;

  @IsString()
  name!: string;
}

class CreateBatchDto {
  @IsString()
  productVariantId!: string;

  @IsString()
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
  serialPrefix?: string;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string | null;
}

class UpdateStatusDto {
  @IsEnum(LifecycleStatus)
  status!: LifecycleStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

const PRODUCT_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.MANUFACTURER_ADMIN,
  UserRole.PRODUCT_MANAGER,
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

  @Get('manufacturers')
  @Roles(...PRODUCT_ROLES)
  listManufacturers(@TenantId() tenantId: string) {
    return this.productService.listManufacturers(tenantId);
  }

  @Post('manufacturers')
  @Roles(...PRODUCT_ROLES)
  createManufacturer(@TenantId() tenantId: string, @Body() dto: CreateManufacturerDto, @CurrentUser() user: AuthUser) {
    return this.productService.createManufacturer(tenantId, dto.name, user.id);
  }

  @Get('brands')
  @Roles(...PRODUCT_ROLES)
  listBrands(@TenantId() tenantId: string, @Query('manufacturerId') manufacturerId?: string) {
    return this.productService.listBrands(tenantId, manufacturerId);
  }

  @Post('brands')
  @Roles(...PRODUCT_ROLES)
  createBrand(@TenantId() tenantId: string, @Body() dto: CreateBrandDto, @CurrentUser() user: AuthUser) {
    return this.productService.createBrand(tenantId, dto.manufacturerId, dto.name, user.id);
  }

  @Get('products')
  @Roles(...PRODUCT_ROLES)
  listProducts(@TenantId() tenantId: string) {
    return this.productService.listProducts(tenantId);
  }

  @Get('products/:productId')
  @Roles(...PRODUCT_ROLES)
  getProduct(@TenantId() tenantId: string, @Param('productId') productId: string) {
    return this.productService.getProduct(tenantId, productId);
  }

  @Post('products')
  @Roles(...PRODUCT_ROLES)
  createProduct(@TenantId() tenantId: string, @Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.productService.createProduct(tenantId, dto.brandId, dto.name, dto.sku, user.id);
  }

  @Patch('products/:productId')
  @Roles(...PRODUCT_ROLES)
  updateProduct(
    @TenantId() tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateProduct(tenantId, productId, dto, user.id);
  }

  @Patch('products/:productId/status')
  @Roles(...PRODUCT_ROLES)
  updateProductStatus(
    @TenantId() tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.updateProductStatus(tenantId, productId, dto.status, user.id, dto.reason);
  }

  @Post('variants')
  @Roles(...PRODUCT_ROLES)
  createVariant(@TenantId() tenantId: string, @Body() dto: CreateVariantDto, @CurrentUser() user: AuthUser) {
    return this.productService.createVariant(tenantId, dto.productId, dto.name, user.id);
  }

  @Get('batches')
  @Roles(...PRODUCT_ROLES)
  listBatches(@TenantId() tenantId: string, @Query('variantId') variantId?: string) {
    return this.productService.listBatches(tenantId, variantId);
  }

  @Get('batches/:batchId')
  @Roles(...PRODUCT_ROLES)
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
  @Roles(...PRODUCT_ROLES)
  listUnits(
    @TenantId() tenantId: string,
    @Param('batchId') batchId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.productService.listUnits(
      batchId,
      tenantId,
      limit ? Math.min(parseInt(limit, 10), 500) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
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
