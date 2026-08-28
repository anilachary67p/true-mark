import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BulkJobStatus, LifecycleStatus } from '@truemark/db';
import { ProductService } from './product.service';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitGenerationService } from './unit-generation.service';
import { QrService } from '../qr/qr.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    client: {
      category: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
      productType: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
      productVariant: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
      tag: { upsert: jest.Mock };
      productVariantTag: { upsert: jest.Mock };
      batch: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
      productUnit: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
      bulkJob: { create: jest.Mock; findFirst: jest.Mock };
      tenant: { findUnique: jest.Mock };
      $transaction: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };
  let unitGeneration: { generateUnits: jest.Mock };
  let qrService: { generateMissingForBatch: jest.Mock };

  const tenantA = 'tenant-a';
  const userId = 'user-1';

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue({}) };
    unitGeneration = {
      generateUnits: jest
        .fn()
        .mockResolvedValue([{ productUnitId: 'u1', serialNumber: 'SN-ABC-2026-000001', tokenPrefix: 'TM-ABCD' }]),
    };
    qrService = { generateMissingForBatch: jest.fn().mockResolvedValue({ created: 1 }) };

    prisma = {
      client: {
        category: {
          create: jest.fn().mockResolvedValue({ id: 'c1', tenantId: tenantA, name: 'Personal Care', status: LifecycleStatus.ACTIVE }),
          findFirst: jest.fn().mockResolvedValue({ id: 'c1', tenantId: tenantA }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        productType: {
          create: jest.fn().mockResolvedValue({ id: 'pt1', tenantId: tenantA, categoryId: 'c1', name: 'Shampoo A' }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'pt1',
            tenantId: tenantA,
            categoryId: 'c1',
            status: LifecycleStatus.ACTIVE,
            metadata: {},
            category: {},
            variants: [],
          }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'pt1', tenantId: tenantA, ...data, metadata: {} }),
          ),
        },
        productVariant: {
          create: jest.fn().mockResolvedValue({
            id: 'v1',
            tenantId: tenantA,
            productTypeId: 'pt1',
            productCode: 'TM-ABCD1234',
          }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'v1',
            tenantId: tenantA,
            productTypeId: 'pt1',
            status: LifecycleStatus.DRAFT,
            metadata: {},
            productType: { category: {} },
            batches: [],
            tags: [],
          }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'v1', tenantId: tenantA, ...data, metadata: {} }),
          ),
        },
        tag: { upsert: jest.fn().mockResolvedValue({ id: 'tag-1' }) },
        productVariantTag: { upsert: jest.fn().mockResolvedValue({}) },
        batch: {
          create: jest.fn().mockResolvedValue({ id: 'batch-1', tenantId: tenantA, batchCode: 'B1', status: LifecycleStatus.DRAFT, metadata: {} }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'batch-1',
            tenantId: tenantA,
            status: LifecycleStatus.DRAFT,
            metadata: {},
            productVariant: { productType: { category: {} }, tags: [] },
          }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'batch-1', status: data.status, metadata: {} }),
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        productUnit: {
          findFirst: jest.fn().mockResolvedValue({ id: 'u1', tenantId: tenantA, status: LifecycleStatus.REGISTERED }),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn().mockResolvedValue({ id: 'u1', status: LifecycleStatus.ACTIVE }),
        },
        bulkJob: {
          create: jest.fn().mockResolvedValue({ id: 'job-1', status: BulkJobStatus.PENDING }),
          findFirst: jest.fn().mockResolvedValue({ id: 'job-1', tenantId: tenantA, status: BulkJobStatus.COMPLETED }),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: tenantA, name: 'Tenant A' }) },
        $transaction: jest.fn((fn) => fn(prisma.client)),
      },
    };

    service = new ProductService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      unitGeneration as unknown as UnitGenerationService,
      qrService as unknown as QrService,
    );
  });

  describe('createProductType', () => {
    it('rejects product type when category not in tenant', async () => {
      prisma.client.category.findFirst.mockResolvedValue(null);
      await expect(service.createProductType(tenantA, 'other-cat', 'Shampoo A', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('audits product type creation', async () => {
      await service.createProductType(tenantA, 'c1', 'Shampoo A', userId);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PRODUCT_TYPE_CREATED' }));
    });
  });

  describe('createBatch', () => {
    it('rejects duplicate batch code', async () => {
      prisma.client.batch.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.createBatch(tenantA, 'v1', 'BATCH-DUP', {}, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateVariantStatus', () => {
    it('allows DRAFT → ACTIVE', async () => {
      const result = await service.updateVariantStatus(tenantA, 'v1', LifecycleStatus.ACTIVE, userId);
      expect(result.status).toBe(LifecycleStatus.ACTIVE);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'VARIANT_STATUS_CHANGED' }));
    });

    it('rejects invalid transition', async () => {
      await expect(service.updateVariantStatus(tenantA, 'v1', LifecycleStatus.REVOKED, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('startUnitGeneration', () => {
    it('generates units synchronously for small quantities', async () => {
      const result = await service.startUnitGeneration(tenantA, 'batch-1', 10, 'ABC', userId, jest.fn());
      expect(result.mode).toBe('sync');
      expect(unitGeneration.generateUnits).toHaveBeenCalled();
      expect(qrService.generateMissingForBatch).toHaveBeenCalledWith(tenantA, 'batch-1', userId);
    });

    it('enqueues async job for large quantities', async () => {
      const enqueue = jest.fn().mockResolvedValue(undefined);
      const result = await service.startUnitGeneration(tenantA, 'batch-1', 1000, 'ABC', userId, enqueue);
      expect(result.mode).toBe('async');
      expect(enqueue).toHaveBeenCalled();
    });
  });

  describe('getBulkJob', () => {
    it('scopes bulk job to tenant', async () => {
      prisma.client.bulkJob.findFirst.mockResolvedValue(null);
      await expect(service.getBulkJob('tenant-b', 'job-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cross-tenant isolation', () => {
    it('returns not found when product type belongs to another tenant', async () => {
      prisma.client.productType.findFirst.mockResolvedValue(null);
      await expect(service.getProductType('tenant-b', 'pt1')).rejects.toThrow(NotFoundException);
    });
  });
});
