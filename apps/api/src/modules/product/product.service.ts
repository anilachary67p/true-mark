import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BulkJobStatus, LifecycleStatus } from '@truemark/db';
import { SYNC_BULK_UNIT_THRESHOLD } from '@truemark/shared';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertLifecycleTransition } from './product-lifecycle.util';
import { UnitGenerationService } from './unit-generation.service';
import { QrService } from '../qr/qr.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly unitGeneration: UnitGenerationService,
    private readonly qrService: QrService,
  ) {}

  // ─── Tenant-scoped lookups ─────────────────────────────────────────────────

  private async requireManufacturer(tenantId: string, manufacturerId: string) {
    const m = await this.prisma.client.manufacturer.findFirst({
      where: { id: manufacturerId, tenantId },
    });
    if (!m) throw new NotFoundException('Manufacturer not found');
    return m;
  }

  private async requireBrand(tenantId: string, brandId: string) {
    const b = await this.prisma.client.brand.findFirst({
      where: { id: brandId, tenantId },
    });
    if (!b) throw new NotFoundException('Brand not found');
    return b;
  }

  private async requireProduct(tenantId: string, productId: string) {
    const p = await this.prisma.client.product.findFirst({
      where: { id: productId, tenantId },
      include: { brand: true, variants: { include: { batches: true } } },
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private async requireVariant(tenantId: string, variantId: string) {
    const v = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: { product: true, batches: true },
    });
    if (!v) throw new NotFoundException('Variant not found');
    return v;
  }

  private async requireBatch(tenantId: string, batchId: string) {
    const b = await this.prisma.client.batch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        productVariant: {
          include: { product: { include: { brand: { include: { manufacturer: true } } } } },
        },
      },
    });
    if (!b) throw new NotFoundException('Batch not found');
    return b;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createManufacturer(tenantId: string, name: string, userId: string) {
    const m = await this.prisma.client.manufacturer.create({
      data: { tenantId, name, status: LifecycleStatus.ACTIVE },
    });
    await this.audit.log({
      action: 'MANUFACTURER_CREATED',
      resourceType: 'manufacturer',
      resourceId: m.id,
      tenantId,
      userId,
      after: m,
    });
    return m;
  }

  async createBrand(tenantId: string, manufacturerId: string, name: string, userId: string) {
    await this.requireManufacturer(tenantId, manufacturerId);
    const b = await this.prisma.client.brand.create({
      data: { tenantId, manufacturerId, name, status: LifecycleStatus.ACTIVE },
    });
    await this.audit.log({
      action: 'BRAND_CREATED',
      resourceType: 'brand',
      resourceId: b.id,
      tenantId,
      userId,
      after: b,
    });
    return b;
  }

  async createProduct(
    tenantId: string,
    brandId: string,
    name: string,
    sku: string | undefined,
    userId: string,
  ) {
    await this.requireBrand(tenantId, brandId);
    const p = await this.prisma.client.product.create({
      data: { tenantId, brandId, name, sku, status: LifecycleStatus.DRAFT },
    });
    await this.audit.log({
      action: 'PRODUCT_CREATED',
      resourceType: 'product',
      resourceId: p.id,
      tenantId,
      userId,
      after: p,
    });
    return p;
  }

  async createVariant(tenantId: string, productId: string, name: string, userId: string) {
    await this.requireProduct(tenantId, productId);
    const v = await this.prisma.client.productVariant.create({
      data: { tenantId, productId, name, status: LifecycleStatus.DRAFT },
    });
    await this.audit.log({
      action: 'VARIANT_CREATED',
      resourceType: 'variant',
      resourceId: v.id,
      tenantId,
      userId,
      after: v,
    });
    return v;
  }

  async createBatch(
    tenantId: string,
    productVariantId: string,
    batchCode: string,
    data: { manufacturingDate?: Date; expiryDate?: Date; metadata?: object },
    userId: string,
  ) {
    await this.requireVariant(tenantId, productVariantId);
    try {
      const b = await this.prisma.client.batch.create({
        data: {
          tenantId,
          productVariantId,
          batchCode,
          status: LifecycleStatus.DRAFT,
          manufacturingDate: data.manufacturingDate,
          expiryDate: data.expiryDate,
          metadata: data.metadata ?? {},
        },
      });
      await this.audit.log({
        action: 'BATCH_CREATED',
        resourceType: 'batch',
        resourceId: b.id,
        tenantId,
        userId,
        after: b,
      });
      return b;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Batch code already exists for this tenant');
      }
      throw err;
    }
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async listManufacturers(tenantId: string) {
    return this.prisma.client.manufacturer.findMany({
      where: { tenantId },
      include: { brands: { include: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listBrands(tenantId: string, manufacturerId?: string) {
    return this.prisma.client.brand.findMany({
      where: { tenantId, ...(manufacturerId ? { manufacturerId } : {}) },
      include: { manufacturer: true, products: true },
      orderBy: { name: 'asc' },
    });
  }

  async listProducts(tenantId: string) {
    return this.prisma.client.product.findMany({
      where: { tenantId },
      include: {
        brand: { include: { manufacturer: true } },
        variants: { include: { batches: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getProduct(tenantId: string, productId: string) {
    return this.requireProduct(tenantId, productId);
  }

  async getBatch(tenantId: string, batchId: string) {
    return this.requireBatch(tenantId, batchId);
  }

  async listBatches(tenantId: string, variantId?: string) {
    return this.prisma.client.batch.findMany({
      where: { tenantId, ...(variantId ? { productVariantId: variantId } : {}) },
      include: { productVariant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUnits(batchId: string, tenantId: string, limit = 100, offset = 0) {
    await this.requireBatch(tenantId, batchId);
    const [items, total] = await Promise.all([
      this.prisma.client.productUnit.findMany({
        where: { batchId, tenantId },
        include: { serial: true, verificationCredential: { select: { tokenPrefix: true, status: true } } },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.productUnit.count({ where: { batchId, tenantId } }),
    ]);
    return { items, total, limit, offset };
  }

  async getBulkJob(tenantId: string, jobId: string) {
    const job = await this.prisma.client.bulkJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Bulk job not found');
    return job;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateProduct(
    tenantId: string,
    productId: string,
    data: { name?: string; sku?: string | null },
    userId: string,
  ) {
    const before = await this.requireProduct(tenantId, productId);
    const after = await this.prisma.client.product.update({
      where: { id: productId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
      },
    });
    await this.audit.log({
      action: 'PRODUCT_UPDATED',
      resourceType: 'product',
      resourceId: productId,
      tenantId,
      userId,
      before,
      after,
    });
    return after;
  }

  async updateProductStatus(
    tenantId: string,
    productId: string,
    status: LifecycleStatus,
    userId: string,
    reason?: string,
  ) {
    const before = await this.requireProduct(tenantId, productId);
    assertLifecycleTransition('catalog', before.status, status);
    const after = await this.prisma.client.product.update({
      where: { id: productId },
      data: {
        status,
        ...(reason
          ? {
              metadata: {
                ...(typeof before.metadata === 'object' && before.metadata !== null
                  ? (before.metadata as Record<string, unknown>)
                  : {}),
                lastStatusReason: reason,
              },
            }
          : {}),
      },
    });
    await this.audit.log({
      action: 'PRODUCT_STATUS_CHANGED',
      resourceType: 'product',
      resourceId: productId,
      tenantId,
      userId,
      before: { status: before.status },
      after: { status: after.status, reason },
    });
    return after;
  }

  async updateBatchStatus(
    tenantId: string,
    batchId: string,
    status: LifecycleStatus,
    userId: string,
    reason?: string,
  ) {
    const before = await this.requireBatch(tenantId, batchId);
    assertLifecycleTransition('unit', before.status, status);
    const after = await this.prisma.client.batch.update({
      where: { id: batchId },
      data: {
        status,
        ...(reason
          ? {
              metadata: {
                ...(typeof before.metadata === 'object' && before.metadata !== null
                  ? (before.metadata as Record<string, unknown>)
                  : {}),
                lastStatusReason: reason,
              },
            }
          : {}),
      },
    });
    await this.audit.log({
      action: 'BATCH_STATUS_CHANGED',
      resourceType: 'batch',
      resourceId: batchId,
      tenantId,
      userId,
      before: { status: before.status },
      after: { status: after.status, reason },
    });
    return after;
  }

  async updateProductUnitStatus(
    tenantId: string,
    unitId: string,
    status: LifecycleStatus,
    userId: string,
  ) {
    const before = await this.prisma.client.productUnit.findFirst({
      where: { id: unitId, tenantId },
    });
    if (!before) throw new NotFoundException('Product unit not found');
    assertLifecycleTransition('unit', before.status, status);
    const after = await this.prisma.client.productUnit.update({
      where: { id: unitId },
      data: { status },
    });
    await this.audit.log({
      action: 'PRODUCT_UNIT_STATUS_CHANGED',
      resourceType: 'product_unit',
      resourceId: unitId,
      tenantId,
      userId,
      before: { status: before.status },
      after: { status: after.status },
    });
    return after;
  }

  // ─── Unit generation ───────────────────────────────────────────────────────

  async startUnitGeneration(
    tenantId: string,
    batchId: string,
    quantity: number,
    serialPrefix: string,
    userId: string,
    enqueue: (payload: {
      jobId: string;
      tenantId: string;
      batchId: string;
      quantity: number;
      serialPrefix: string;
    }) => Promise<void>,
  ) {
    if (quantity < 1 || quantity > 100_000) {
      throw new BadRequestException('Quantity must be between 1 and 100000');
    }

    const batch = await this.requireBatch(tenantId, batchId);
    if (batch.status === LifecycleStatus.RECALLED || batch.status === LifecycleStatus.REVOKED) {
      throw new BadRequestException('Cannot generate units for a recalled or revoked batch');
    }

    const existingCount = await this.prisma.client.productUnit.count({
      where: { batchId, tenantId },
    });

    if (quantity <= SYNC_BULK_UNIT_THRESHOLD) {
      const records = await this.unitGeneration.generateUnits(
        tenantId,
        batchId,
        quantity,
        serialPrefix,
        existingCount,
      );
      if (batch.status === LifecycleStatus.DRAFT) {
        await this.prisma.client.batch.update({
          where: { id: batchId },
          data: { status: LifecycleStatus.ACTIVE },
        });
      }
      const qrResult = await this.qrService.generateMissingForBatch(tenantId, batchId, userId);
      return {
        mode: 'sync' as const,
        generated: records.length,
        units: records,
        qrCodesCreated: qrResult.created,
      };
    }

    const job = await this.prisma.client.bulkJob.create({
      data: { tenantId, batchId, quantity, status: BulkJobStatus.PENDING },
    });
    await enqueue({
      jobId: job.id,
      tenantId,
      batchId,
      quantity,
      serialPrefix,
    });
    return { mode: 'async' as const, jobId: job.id, status: BulkJobStatus.PENDING };
  }

  /** Used by bulk job processor — generates units starting after existing count. */
  async getBatchUnitCount(tenantId: string, batchId: string): Promise<number> {
    await this.requireBatch(tenantId, batchId);
    return this.prisma.client.productUnit.count({ where: { batchId, tenantId } });
  }
}
