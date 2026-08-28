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
      manufacturer: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
      brand: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
      product: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
      productVariant: { create: jest.Mock; findFirst: jest.Mock };
      batch: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
      productUnit: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
      bulkJob: { create: jest.Mock; findFirst: jest.Mock };
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
    unitGeneration = { generateUnits: jest.fn().mockResolvedValue([{ productUnitId: 'u1', serialNumber: 'SN-ABC-2026-000001', tokenPrefix: 'TM-ABCD' }]) };
    qrService = { generateMissingForBatch: jest.fn().mockResolvedValue({ created: 1 }) };

    prisma = {
      client: {
        manufacturer: {
          create: jest.fn().mockResolvedValue({ id: 'm1', tenantId: tenantA, name: 'Mfg', status: LifecycleStatus.ACTIVE }),
          findFirst: jest.fn().mockResolvedValue({ id: 'm1', tenantId: tenantA }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        brand: {
          create: jest.fn().mockResolvedValue({ id: 'b1', tenantId: tenantA, manufacturerId: 'm1', name: 'Brand' }),
          findFirst: jest.fn().mockResolvedValue({ id: 'b1', tenantId: tenantA, manufacturerId: 'm1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        product: {
          create: jest.fn().mockResolvedValue({ id: 'p1', tenantId: tenantA, status: LifecycleStatus.DRAFT, metadata: {} }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'p1',
            tenantId: tenantA,
            status: LifecycleStatus.DRAFT,
            metadata: {},
            brand: {},
            variants: [],
          }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'p1', tenantId: tenantA, ...data, metadata: {} }),
          ),
        },
        productVariant: {
          create: jest.fn().mockResolvedValue({ id: 'v1', tenantId: tenantA, productId: 'p1' }),
          findFirst: jest.fn().mockResolvedValue({ id: 'v1', tenantId: tenantA, productId: 'p1', product: {}, batches: [] }),
        },
        batch: {
          create: jest.fn().mockResolvedValue({ id: 'batch-1', tenantId: tenantA, batchCode: 'B1', status: LifecycleStatus.DRAFT, metadata: {} }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'batch-1',
            tenantId: tenantA,
            status: LifecycleStatus.DRAFT,
            metadata: {},
            productVariant: { product: { brand: { manufacturer: {} } } },
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

  describe('createBrand', () => {
    it('rejects brand when manufacturer not in tenant', async () => {
      prisma.client.manufacturer.findFirst.mockResolvedValue(null);
      await expect(service.createBrand(tenantA, 'other-mfg', 'Brand', userId)).rejects.toThrow(NotFoundException);
    });

    it('audits brand creation', async () => {
      await service.createBrand(tenantA, 'm1', 'Brand', userId);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'BRAND_CREATED' }));
    });
  });

  describe('createBatch', () => {
    it('rejects duplicate batch code', async () => {
      prisma.client.batch.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.createBatch(tenantA, 'v1', 'BATCH-DUP', {}, userId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProductStatus', () => {
    it('allows DRAFT → ACTIVE', async () => {
      const result = await service.updateProductStatus(tenantA, 'p1', LifecycleStatus.ACTIVE, userId);
      expect(result.status).toBe(LifecycleStatus.ACTIVE);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PRODUCT_STATUS_CHANGED' }));
    });

    it('rejects invalid transition', async () => {
      await expect(
        service.updateProductStatus(tenantA, 'p1', LifecycleStatus.REVOKED, userId),
      ).rejects.toThrow(BadRequestException);
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
    it('returns not found when product belongs to another tenant', async () => {
      prisma.client.product.findFirst.mockResolvedValue(null);
      await expect(service.getProduct('tenant-b', 'p1')).rejects.toThrow(NotFoundException);
    });
  });
});
