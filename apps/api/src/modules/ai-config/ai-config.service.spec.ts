import { AiMode } from '@truemark/db';
import { AiConfigService } from './ai-config.service';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AiConfigService', () => {
  let service: AiConfigService;
  let prisma: {
    client: {
      aiConfig: { findUnique: jest.Mock; upsert: jest.Mock };
      aiReferenceData: { create: jest.Mock; delete: jest.Mock; findFirst: jest.Mock };
      aiJob: { count: jest.Mock };
    };
  };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue({}) };
    prisma = {
      client: {
        aiConfig: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', tenantId: 't1', mode: AiMode.AI_DISABLED }),
          upsert: jest
            .fn()
            .mockResolvedValue({ id: 'cfg-1', mode: AiMode.AI_OPTIONAL, quota: 500 }),
        },
        aiReferenceData: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 'ref-1', scope: 'product', objectKey: 'refs/p1.jpg' }),
          delete: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue({ id: 'ref-1', tenantId: 't1' }),
        },
        aiJob: { count: jest.fn().mockResolvedValue(0) },
      },
    };
    service = new AiConfigService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('updates AI mode and audits', async () => {
    const result = await service.update('t1', { mode: AiMode.AI_OPTIONAL, quota: 500 }, 'user-1');
    expect(result.mode).toBe(AiMode.AI_OPTIONAL);
    expect(audit.log).toHaveBeenCalled();
  });

  it('creates reference data for tenant', async () => {
    const ref = await service.createReferenceData(
      't1',
      { scope: 'product', scopeId: 'p1', objectKey: 'refs/p1.jpg' },
      'user-1',
    );
    expect(ref.objectKey).toBe('refs/p1.jpg');
  });
});
