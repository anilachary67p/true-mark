import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../providers/prisma.service';
import { Public } from '../auth/public.decorator';
import { HybridBoundaryService } from '../hybrid/hybrid-boundary.service';

const DB_CHECK_TIMEOUT_MS = 3000;

@ApiTags('health')
@SkipThrottle()
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
    try {
      await Promise.race([
        this.prisma.client.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('database check timed out')), DB_CHECK_TIMEOUT_MS).unref(),
        ),
      ]);
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' },
      });
    }

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
