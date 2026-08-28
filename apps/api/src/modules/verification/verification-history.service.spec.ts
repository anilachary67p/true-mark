import { VerificationHistoryService } from './verification-history.service';
import { PrismaService } from '../../providers/prisma.service';

describe('VerificationHistoryService', () => {
  let service: VerificationHistoryService;
  let prisma: { client: { verificationEvent: { findMany: jest.Mock; count: jest.Mock } } };

  beforeEach(() => {
    prisma = {
      client: {
        verificationEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              publicId: 'pub-1',
              result: 'VERIFIED',
              method: 'QR_SCAN',
              riskLevel: 'LOW',
              correlationId: 'c1',
              createdAt: new Date(),
              productSnapshot: {},
              fraudSignals: [],
              productUnit: { serial: { serialNumber: 'SN-1' } },
              location: null,
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
      },
    };
    service = new VerificationHistoryService(prisma as unknown as PrismaService);
  });

  it('lists tenant-scoped verification events', async () => {
    const result = await service.listForTenant('tenant-a');
    expect(result.total).toBe(1);
    expect(result.items[0].serial).toBe('SN-1');
    expect(prisma.client.verificationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
  });
});
