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
import { generateProductCode } from './product-code.util';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly unitGeneration: UnitGenerationService,
    private readonly qrService: QrService,
  ) {}

  private async requireCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.client.category.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async requireProductType(tenantId: string, productTypeId: string) {
    const productType = await this.prisma.client.productType.findFirst({
      where: { id: productTypeId, tenantId },
      include: {
        category: true,
        variants: { include: { batches: true, tags: { include: { tag: true } } } },
      },
    });
    if (!productType) throw new NotFoundException('Product type not found');
    return productType;
  }

  private async requireVariant(tenantId: string, variantId: string) {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: {
        productType: { include: { category: true } },
        batches: true,
        tags: { include: { tag: true } },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  private async requireBatch(tenantId: string, batchId: string) {
    const batch = await this.prisma.client.batch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        productVariant: {
          include: {
            productType: { include: { category: true } },
            tags: { include: { tag: true } },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  private async attachTags(tenantId: string, variantId: string, tagNames: string[]) {
    const normalized = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
    for (const name of normalized) {
      const tag = await this.prisma.client.tag.upsert({
        where: { tenantId_name: { tenantId, name } },
        create: { tenantId, name },
        update: {},
      });
      await this.prisma.client.productVariantTag.upsert({
        where: { productVariantId_tagId: { productVariantId: variantId, tagId: tag.id } },
        create: { productVariantId: variantId, tagId: tag.id },
        update: {},
      });
    }
  }

  private async createVariantWithCode(
    tenantId: string,
    productTypeId: string,
    name: string,
    tags: string[] | undefined,
    userId: string,
    attempt = 0,
  ): Promise<Awaited<ReturnType<ProductService['requireVariant']>>> {
    const productCode = generateProductCode();
    try {
      const variant = await this.prisma.client.productVariant.create({
        data: { tenantId, productTypeId, name, productCode, status: LifecycleStatus.DRAFT },
      });
      if (tags?.length) {
        await this.attachTags(tenantId, variant.id, tags);
      }
      await this.audit.log({
        action: 'VARIANT_CREATED',
        resourceType: 'variant',
        resourceId: variant.id,
        tenantId,
        userId,
        after: variant,
      });
      return this.requireVariant(tenantId, variant.id);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 'P2002' &&
        attempt < 5
      ) {
        return this.createVariantWithCode(tenantId, productTypeId, name, tags, userId, attempt + 1);
      }
      throw err;
    }
  }

  async createCategory(tenantId: string, name: string, userId: string) {
    try {
      const category = await this.prisma.client.category.create({
        data: { tenantId, name, status: LifecycleStatus.ACTIVE },
      });
      await this.audit.log({
        action: 'CATEGORY_CREATED',
        resourceType: 'category',
        resourceId: category.id,
        tenantId,
        userId,
        after: category,
      });
      return category;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Category name already exists for this tenant');
      }
      throw err;
    }
  }

  async createProductType(tenantId: string, categoryId: string, name: string, userId: string) {
    await this.requireCategory(tenantId, categoryId);
    try {
      const productType = await this.prisma.client.productType.create({
        data: { tenantId, categoryId, name, status: LifecycleStatus.ACTIVE },
      });
      await this.audit.log({
        action: 'PRODUCT_TYPE_CREATED',
        resourceType: 'product_type',
        resourceId: productType.id,
        tenantId,
        userId,
        after: productType,
      });
      return productType;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Product type name already exists in this category');
      }
      throw err;
    }
  }

  async createVariant(
    tenantId: string,
    productTypeId: string,
    name: string,
    userId: string,
    tags?: string[],
  ) {
    await this.requireProductType(tenantId, productTypeId);
    return this.createVariantWithCode(tenantId, productTypeId, name, tags, userId);
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
      const batch = await this.prisma.client.batch.create({
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
        resourceId: batch.id,
        tenantId,
        userId,
        after: batch,
      });
      return batch;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Batch code already exists for this tenant');
      }
      throw err;
    }
  }

  async listCategories(tenantId: string) {
    return this.prisma.client.category.findMany({
      where: { tenantId },
      include: {
        productTypes: {
          include: {
            variants: { include: { tags: { include: { tag: true } }, batches: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listProductTypes(tenantId: string, categoryId?: string) {
    return this.prisma.client.productType.findMany({
      where: { tenantId, ...(categoryId ? { categoryId } : {}) },
      include: {
        category: true,
        variants: { include: { tags: { include: { tag: true } }, batches: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listVariants(tenantId: string, filters?: { tag?: string; productTypeId?: string }) {
    const tagFilter = filters?.tag?.trim();
    return this.prisma.client.productVariant.findMany({
      where: {
        tenantId,
        ...(filters?.productTypeId ? { productTypeId: filters.productTypeId } : {}),
        ...(tagFilter
          ? { tags: { some: { tag: { name: { equals: tagFilter, mode: 'insensitive' } } } } }
          : {}),
      },
      include: {
        productType: { include: { category: true } },
        tags: { include: { tag: true } },
        batches: true,
      },
      orderBy: [{ productType: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async listTags(tenantId: string) {
    return this.prisma.client.tag.findMany({
      where: { tenantId },
      include: { _count: { select: { variants: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getProductType(tenantId: string, productTypeId: string) {
    return this.requireProductType(tenantId, productTypeId);
  }

  async getVariant(tenantId: string, variantId: string) {
    return this.requireVariant(tenantId, variantId);
  }

  async getBatch(tenantId: string, batchId: string) {
    return this.requireBatch(tenantId, batchId);
  }

  async listBatches(tenantId: string, variantId?: string) {
    return this.prisma.client.batch.findMany({
      where: { tenantId, ...(variantId ? { productVariantId: variantId } : {}) },
      include: {
        productVariant: {
          include: {
            productType: { include: { category: true } },
            tags: { include: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUnits(batchId: string, tenantId: string, limit = 100, offset = 0) {
    await this.requireBatch(tenantId, batchId);
    const [items, total] = await Promise.all([
      this.prisma.client.productUnit.findMany({
        where: { batchId, tenantId },
        include: {
          serial: true,
          verificationCredential: { select: { tokenPrefix: true, status: true } },
        },
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

  async getCatalogStats(tenantId: string) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const categories = await this.prisma.client.category.findMany({
      where: { tenantId },
      include: {
        productTypes: {
          include: {
            _count: { select: { variants: true } },
            variants: { select: { id: true, name: true, productCode: true, status: true } },
          },
        },
        _count: { select: { productTypes: true } },
      },
      orderBy: { name: 'asc' },
    });

    const [productTypeCount, variantCount, tagCount] = await Promise.all([
      this.prisma.client.productType.count({ where: { tenantId } }),
      this.prisma.client.productVariant.count({ where: { tenantId } }),
      this.prisma.client.tag.count({ where: { tenantId } }),
    ]);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      totals: {
        categories: categories.length,
        productTypes: productTypeCount,
        variants: variantCount,
        tags: tagCount,
      },
      categories: categories.map((category) => {
        const variantCountForCategory = category.productTypes.reduce(
          (sum, pt) => sum + pt._count.variants,
          0,
        );
        return {
          id: category.id,
          name: category.name,
          status: category.status,
          productTypeCount: category._count.productTypes,
          variantCount: variantCountForCategory,
          productTypes: category.productTypes.map((pt) => ({
            id: pt.id,
            name: pt.name,
            status: pt.status,
            variantCount: pt._count.variants,
            variants: pt.variants,
          })),
        };
      }),
    };
  }

  async getPlatformOverview() {
    const tenants = await this.prisma.client.tenant.findMany({
      select: { id: true, name: true, status: true, deploymentType: true },
      orderBy: { createdAt: 'desc' },
    });

    const [categoryCount, productTypeCount, variantCount, tagCount, licenseCount] =
      await Promise.all([
        this.prisma.client.category.count(),
        this.prisma.client.productType.count(),
        this.prisma.client.productVariant.count(),
        this.prisma.client.tag.count(),
        this.prisma.client.tenantLicense.count(),
      ]);

    const tenantSummaries = await Promise.all(
      tenants.map(async (tenant) => {
        const [categories, productTypes, variants, tags] = await Promise.all([
          this.prisma.client.category.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.productType.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.productVariant.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.tag.count({ where: { tenantId: tenant.id } }),
        ]);
        const license = await this.prisma.client.tenantLicense.findUnique({
          where: { tenantId: tenant.id },
          select: { validUntil: true, commercialModel: true },
        });
        return {
          ...tenant,
          catalog: { categories, productTypes, variants, tags },
          license: license
            ? { validUntil: license.validUntil, commercialModel: license.commercialModel }
            : null,
        };
      }),
    );

    return {
      totals: {
        tenants: tenants.length,
        categories: categoryCount,
        productTypes: productTypeCount,
        variants: variantCount,
        tags: tagCount,
        licenses: licenseCount,
      },
      tenants: tenantSummaries,
    };
  }

  async updateProductTypeStatus(
    tenantId: string,
    productTypeId: string,
    status: LifecycleStatus,
    userId: string,
    reason?: string,
  ) {
    const before = await this.requireProductType(tenantId, productTypeId);
    assertLifecycleTransition('catalog', before.status, status);
    const after = await this.prisma.client.productType.update({
      where: { id: productTypeId },
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
      action: 'PRODUCT_TYPE_STATUS_CHANGED',
      resourceType: 'product_type',
      resourceId: productTypeId,
      tenantId,
      userId,
      before: { status: before.status },
      after: { status: after.status, reason },
    });
    return after;
  }

  async updateVariantStatus(
    tenantId: string,
    variantId: string,
    status: LifecycleStatus,
    userId: string,
    reason?: string,
  ) {
    const before = await this.requireVariant(tenantId, variantId);
    assertLifecycleTransition('catalog', before.status, status);
    const after = await this.prisma.client.productVariant.update({
      where: { id: variantId },
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
      action: 'VARIANT_STATUS_CHANGED',
      resourceType: 'variant',
      resourceId: variantId,
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

  async getBatchUnitCount(tenantId: string, batchId: string): Promise<number> {
    await this.requireBatch(tenantId, batchId);
    return this.prisma.client.productUnit.count({ where: { batchId, tenantId } });
  }
}
