import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { DomainStatus } from '@truemark/db';
import { DomainService } from './domain.service';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('DomainService', () => {
  let service: DomainService;
  let prisma: {
    client: {
      tenant: { update: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock };
      companyDomain: {
        create: jest.Mock;
        findFirst: jest.Mock;
        findUnique: jest.Mock;
        update: jest.Mock;
        findMany: jest.Mock;
      };
      verificationDomain: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        findMany: jest.Mock;
        count: jest.Mock;
      };
      domainVerificationChallenge: { create: jest.Mock; update: jest.Mock };
      $transaction: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  const tenantA = 'tenant-a-id';
  const tenantB = 'tenant-b-id';

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue({}) };
    prisma = {
      client: {
        tenant: {
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ id: tenantA, name: 'ABC' }),
        },
        companyDomain: {
          create: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'cd-1', ...data, status: DomainStatus.PENDING, version: 1 }),
          ),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        verificationDomain: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(1),
        },
        domainVerificationChallenge: {
          create: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((fn) => (typeof fn === 'function' ? fn(prisma.client) : Promise.all(fn))),
      },
    };

    service = new DomainService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('createCompanyDomain', () => {
    it('stores normalized HTTPS company domain', async () => {
      const result = await service.createCompanyDomain(
        tenantA,
        'https://WWW.ABCPHARMA.COM/',
        'user-1',
      );
      expect(result.url).toBe('https://www.abcpharma.com');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPANY_DOMAIN_CREATED', tenantId: tenantA }),
      );
    });
  });

  describe('createVerificationDomain', () => {
    it('rejects duplicate verification domain for another tenant', async () => {
      prisma.client.verificationDomain.findUnique.mockResolvedValue({
        id: 'vd-1',
        tenantId: tenantA,
        hostname: 'verify.abcpharma.com',
      });

      await expect(
        service.createVerificationDomain(tenantB, 'verify.abcpharma.com', '/v', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects example.com verification domain', async () => {
      await expect(
        service.createVerificationDomain(tenantA, 'example.com', '/v', 'user-1'),
      ).rejects.toThrow('domain policy');
    });
  });

  describe('tenant isolation', () => {
    it('forbids cross-tenant verification domain status update', async () => {
      prisma.client.verificationDomain.findUnique.mockResolvedValue({
        id: 'vd-1',
        tenantId: tenantA,
        status: DomainStatus.ACTIVE,
        version: 1,
        challenges: [],
      });

      await expect(
        service.updateVerificationDomainStatus(
          tenantB,
          'vd-1',
          DomainStatus.SUSPENDED,
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns not found for missing domain', async () => {
      prisma.client.verificationDomain.findUnique.mockResolvedValue(null);

      await expect(
        service.getVerificationChallenge(tenantA, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateVerificationDomainStatus', () => {
    it('allows suspending an active domain', async () => {
      prisma.client.verificationDomain.findUnique.mockResolvedValue({
        id: 'vd-1',
        tenantId: tenantA,
        status: DomainStatus.ACTIVE,
        version: 2,
        hostname: 'verify.abcpharma.com',
        challenges: [],
      });
      prisma.client.verificationDomain.update.mockResolvedValue({
        id: 'vd-1',
        status: DomainStatus.SUSPENDED,
        version: 3,
      });

      const result = await service.updateVerificationDomainStatus(
        tenantA,
        'vd-1',
        DomainStatus.SUSPENDED,
        'user-1',
      );

      expect(result.status).toBe(DomainStatus.SUSPENDED);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOMAIN_STATUS_CHANGED' }),
      );
    });
  });
});
