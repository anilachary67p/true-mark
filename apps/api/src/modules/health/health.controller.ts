import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../providers/prisma.service';
import { Public } from '../auth/public.decorator';
import { HybridBoundaryService } from '../hybrid/hybrid-boundary.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hybridBoundary: HybridBoundaryService,
  ) {}

  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'truemark-api', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    await this.prisma.client.$queryRaw`SELECT 1`;
    const hybridGateway = await this.hybridBoundary.checkGatewayReachable();
    return {
      status: 'ready',
      checks: {
        database: 'ok',
        hybridGateway: hybridGateway.ok ? 'ok' : 'degraded',
        ...(hybridGateway.latencyMs != null ? { hybridGatewayLatencyMs: hybridGateway.latencyMs } : {}),
      },
    };
  }
}
