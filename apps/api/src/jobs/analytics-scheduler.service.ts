import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../providers/prisma.service';

@Injectable()
export class AnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('analytics-rollup') private readonly rollupQueue: Queue,
  ) {}

  async onModuleInit() {
    if (process.env.DISABLE_ANALYTICS_SCHEDULER === 'true') return;

    await this.rollupQueue.add(
      'schedule-daily',
      {},
      {
        repeat: { pattern: '0 2 * * *' },
        jobId: 'analytics-daily-scheduler',
      },
    );

    this.logger.log('Analytics daily rollup scheduler registered (02:00 UTC)');
  }

  async enqueueDailyRollupsForAllTenants() {
    const tenants = await this.prisma.client.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING'] } },
      select: { id: true },
    });
    const date = new Date().toISOString().slice(0, 10);

    for (const tenant of tenants) {
      await this.rollupQueue.add('rollup-tenant', { tenantId: tenant.id, date });
    }

    return { tenants: tenants.length, date };
  }
}
