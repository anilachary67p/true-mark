import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    client: {
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    },
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as never);
  });

  it('lists audit logs for tenant with filters', async () => {
    prisma.client.auditLog.findMany.mockResolvedValue([
      { id: 'a1', action: 'QR_STATUS_CHANGED', resourceType: 'qr_code' },
    ]);
    prisma.client.auditLog.count.mockResolvedValue(1);

    const result = await service.listForTenant('tenant-1', {
      action: 'QR_STATUS_CHANGED',
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', action: 'QR_STATUS_CHANGED' }),
      }),
    );
  });
});
