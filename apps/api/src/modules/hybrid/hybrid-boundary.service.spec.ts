import { DeploymentType } from '@truemark/db';
import { HybridBoundaryService } from './hybrid-boundary.service';

describe('HybridBoundaryService', () => {
  const audit = { log: jest.fn() };
  const prisma = {
    client: {
      tenant: { findUnique: jest.fn() },
    },
  };

  function createService(env: Record<string, string | undefined>) {
    const config = {
      get: (key: string) => env[key],
    };
    return new HybridBoundaryService(prisma as never, audit as never, config as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows transfer in cloud runtime without hybrid checks', async () => {
    const svc = createService({ DEPLOYMENT_RUNTIME: 'cloud' });
    prisma.client.tenant.findUnique.mockResolvedValue({
      deploymentType: DeploymentType.HYBRID,
      profile: { metadata: {} },
    });

    const result = await svc.canTransferConsumerImages('tenant-1');
    expect(result.allowed).toBe(true);
  });

  it('blocks on-prem hybrid without explicit opt-in', async () => {
    const svc = createService({
      DEPLOYMENT_RUNTIME: 'on_prem',
      HYBRID_MODE: 'CORE_ONPREM_AI_CLOUD',
    });
    prisma.client.tenant.findUnique.mockResolvedValue({
      deploymentType: DeploymentType.HYBRID,
      profile: { metadata: { hybrid: { dataBoundary: { consumerImages: 'on_prem' } } } },
    });

    const result = await svc.canTransferConsumerImages('tenant-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('opt-in');
  });

  it('allows on-prem hybrid when consumerImages=cloud', async () => {
    const svc = createService({
      DEPLOYMENT_RUNTIME: 'on_prem',
      HYBRID_MODE: 'CORE_ONPREM_AI_CLOUD',
    });
    prisma.client.tenant.findUnique.mockResolvedValue({
      deploymentType: DeploymentType.HYBRID,
      profile: {
        metadata: { hybrid: { dataBoundary: { consumerImages: 'cloud' } } },
      },
    });

    const result = await svc.canTransferConsumerImages('tenant-1');
    expect(result.allowed).toBe(true);
  });
});
