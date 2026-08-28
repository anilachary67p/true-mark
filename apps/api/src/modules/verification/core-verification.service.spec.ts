import { AiMode, LifecycleStatus, VerificationMethod, VerificationResult } from '@truemark/db';
import { CoreVerificationService } from './core-verification.service';
import { PrismaService } from '../../providers/prisma.service';
import { DomainService } from '../domain/domain.service';
import { CredentialService } from '../credential/credential.service';
import { SignalEvaluatorService } from '../fraud/signal-evaluator.service';

const mockUnit = {
  id: 'unit-1',
  batch: {
    batchCode: 'BATCH-2026-08',
    expiryDate: new Date('2028-01-01'),
    status: LifecycleStatus.ACTIVE,
    productVariant: {
      name: 'Shampoo A 500ml',
      productCode: 'TM-SEED500ML',
      productType: {
        name: 'Shampoo A',
        category: { name: 'Personal Care' },
      },
      tags: [{ tag: { name: 'SH-A' } }, { tag: { name: 'SH-A-500' } }],
    },
  },
  serial: { serialNumber: 'SN-ABC-2026-000001' },
  qrCode: { id: 'qr-1', status: LifecycleStatus.ACTIVE },
};

describe('CoreVerificationService', () => {
  let service: CoreVerificationService;
  let prisma: {
    client: {
      qrCode: { findFirst: jest.Mock };
      verificationCredential: { findMany: jest.Mock };
      verificationEvent: { findMany: jest.Mock; create: jest.Mock };
      fraudConfig: { findUnique: jest.Mock };
      aiConfig: { findUnique: jest.Mock };
    };
  };
  let domainService: { resolveTenantByHostname: jest.Mock };
  let credentialService: { normalizeCode: jest.Mock };
  let signalEvaluator: { evaluateReuse: jest.Mock };

  const tenantId = 'tenant-a';
  const domain = { id: 'domain-1', tenantId, version: 1, hostname: 'verify.localhost' };

  beforeEach(() => {
    prisma = {
      client: {
        qrCode: { findFirst: jest.fn() },
        verificationCredential: { findMany: jest.fn() },
        verificationEvent: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ publicId: 'pub-1' }),
        },
        fraudConfig: { findUnique: jest.fn().mockResolvedValue(null) },
        aiConfig: { findUnique: jest.fn().mockResolvedValue({ mode: AiMode.AI_OPTIONAL }) },
      },
    };
    domainService = {
      resolveTenantByHostname: jest.fn().mockResolvedValue(domain),
    };
    credentialService = {
      normalizeCode: jest.fn((c: string) => c.trim().toUpperCase()),
    };
    signalEvaluator = {
      evaluateReuse: jest.fn().mockReturnValue({
        riskLevel: 'LOW',
        signals: [],
        suggestedResult: undefined,
      }),
    };

    service = new CoreVerificationService(
      prisma as unknown as PrismaService,
      domainService as unknown as DomainService,
      credentialService as unknown as CredentialService,
      signalEvaluator as unknown as SignalEvaluatorService,
    );
  });

  describe('verifyByQr', () => {
    it('returns UNABLE_TO_VERIFY for unknown domain', async () => {
      domainService.resolveTenantByHostname.mockResolvedValue(null);
      const result = await service.verifyByQr(
        'https://evil.example/v/token',
        'evil.example',
        undefined,
        'corr-1',
      );
      expect(result.result).toBe(VerificationResult.UNABLE_TO_VERIFY);
      expect(result.verificationPublicId).toBe('');
    });

    it('returns UNABLE_TO_VERIFY for HTTP URL', async () => {
      const result = await service.verifyByQr(
        'http://verify.localhost/v/token',
        'verify.localhost',
        undefined,
        'corr-2',
      );
      expect(result.result).toBe(VerificationResult.UNABLE_TO_VERIFY);
    });

    it('returns UNKNOWN_QR when token not found', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue(null);
      const result = await service.verifyByQr(
        'https://verify.localhost/v/missing-token',
        'verify.localhost',
        undefined,
        'corr-3',
      );
      expect(result.result).toBe(VerificationResult.UNKNOWN_QR);
      expect(prisma.client.verificationEvent.create).toHaveBeenCalled();
    });

    it('returns VERIFIED for raw QR payload (non-URL token)', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue({
        productUnit: {
          ...mockUnit,
          verificationCredential: {
            status: LifecycleStatus.ACTIVE,
            productUnitId: 'unit-1',
          },
        },
      });

      const result = await service.verifyByQr(
        '1234512345123451234512345',
        'verify.localhost',
        undefined,
        'corr-raw',
      );

      expect(result.result).toBe(VerificationResult.VERIFIED);
      expect(prisma.client.qrCode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, token: '1234512345123451234512345' },
        }),
      );
    });

    it('returns VERIFIED for valid active credential', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue({
        productUnit: {
          ...mockUnit,
          verificationCredential: {
            status: LifecycleStatus.ACTIVE,
            productUnitId: 'unit-1',
          },
        },
      });

      const result = await service.verifyByQr(
        'https://verify.localhost/v/valid-token',
        'verify.localhost',
        undefined,
        'corr-4',
      );

      expect(result.result).toBe(VerificationResult.VERIFIED);
      expect(result.product?.name).toBe('Shampoo A 500ml');
      expect(result.aiAvailable).toBe(true);
    });

    it('returns REVOKED_QR when QR lifecycle is revoked', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue({
        productUnit: {
          ...mockUnit,
          qrCode: { id: 'qr-1', status: LifecycleStatus.REVOKED },
          verificationCredential: {
            status: LifecycleStatus.ACTIVE,
            productUnitId: 'unit-1',
          },
        },
      });

      const result = await service.verifyByQr(
        'https://verify.localhost/v/revoked-token',
        'verify.localhost',
        undefined,
        'corr-5',
      );

      expect(result.result).toBe(VerificationResult.REVOKED_QR);
    });

    it('returns EXPIRED for expired batch', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue({
        productUnit: {
          ...mockUnit,
          batch: { ...mockUnit.batch, expiryDate: new Date('2020-01-01') },
          verificationCredential: { status: LifecycleStatus.ACTIVE, productUnitId: 'unit-1' },
        },
      });

      const result = await service.verifyByQr(
        'https://verify.localhost/v/expired-token',
        'verify.localhost',
        undefined,
        'corr-6',
      );

      expect(result.result).toBe(VerificationResult.EXPIRED);
    });

    it('returns RECALLED for recalled batch', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue({
        productUnit: {
          ...mockUnit,
          batch: { ...mockUnit.batch, status: LifecycleStatus.RECALLED },
          verificationCredential: { status: LifecycleStatus.ACTIVE, productUnitId: 'unit-1' },
        },
      });

      const result = await service.verifyByQr(
        'https://verify.localhost/v/recalled-token',
        'verify.localhost',
        undefined,
        'corr-7',
      );

      expect(result.result).toBe(VerificationResult.RECALLED);
      expect(result.message).toContain('recalled');
    });
  });
});
