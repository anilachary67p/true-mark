import { NotFoundException } from '@nestjs/common';
import { LifecycleStatus } from '@truemark/db';
import { QrService } from './qr.service';
import { PrismaService } from '../../providers/prisma.service';
import { DomainService } from '../domain/domain.service';
import { CredentialService } from '../credential/credential.service';
import { QrRenderService } from './qr.service';
import { AuditService } from '../audit/audit.service';

describe('QrService', () => {
  let service: QrService;
  let prisma: {
    client: {
      qrCode: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock };
      qrLifecycleEvent: { create: jest.Mock };
      batch: { findFirst: jest.Mock };
      productUnit: { findMany: jest.Mock; update: jest.Mock };
      verificationCredential: { updateMany: jest.Mock };
      $transaction: jest.Mock;
    };
  };
  let domainService: { getActivePrimaryDomain: jest.Mock; resolveTenantByHostname: jest.Mock };
  let credentialService: { generateQrToken: jest.Mock };
  let audit: { log: jest.Mock };

  const tenantId = 'tenant-a';

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue({}) };
    domainService = {
      getActivePrimaryDomain: jest.fn().mockResolvedValue({
        hostname: 'verify.abcpharma.com',
        verificationPath: '/v',
        version: 1,
      }),
      resolveTenantByHostname: jest.fn(),
    };
    credentialService = { generateQrToken: jest.fn().mockReturnValue('qr-token-abc') };

    prisma = {
      client: {
        qrCode: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'qr-1',
            tenantId,
            productUnitId: 'unit-1',
            status: LifecycleStatus.ACTIVE,
            url: 'https://verify.abcpharma.com/v/tok',
            productUnit: { serial: { serialNumber: 'SN-1' } },
          }),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'qr-new', ...data })),
          update: jest.fn().mockResolvedValue({ id: 'qr-1', status: LifecycleStatus.REVOKED }),
          count: jest.fn().mockResolvedValue(0),
        },
        qrLifecycleEvent: { create: jest.fn().mockResolvedValue({}) },
        batch: { findFirst: jest.fn().mockResolvedValue({ id: 'batch-1', tenantId }) },
        productUnit: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({}),
        },
        verificationCredential: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        $transaction: jest.fn((fn) => fn(prisma.client)),
      },
    };

    service = new QrService(
      prisma as unknown as PrismaService,
      domainService as unknown as DomainService,
      credentialService as unknown as CredentialService,
      new QrRenderService(undefined),
      audit as unknown as AuditService,
    );
  });

  describe('buildVerificationUrl', () => {
    it('builds HTTPS verification URL with path prefix', () => {
      expect(service.buildVerificationUrl('verify.abcpharma.com', '/v', 'abc123')).toBe(
        'https://verify.abcpharma.com/v/abc123',
      );
    });
  });

  describe('updateStatus', () => {
    it('revokes QR and audits change', async () => {
      const result = await service.updateStatus(
        tenantId,
        'qr-1',
        LifecycleStatus.REVOKED,
        'user-1',
        'Compromised batch',
      );
      expect(result.status).toBe(LifecycleStatus.REVOKED);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'QR_STATUS_CHANGED' }));
    });

    it('returns not found for cross-tenant QR', async () => {
      prisma.client.qrCode.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatus(tenantId, 'missing', LifecycleStatus.REVOKED, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
