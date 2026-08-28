import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const [total, byResult, recent, aiJobs, investigations] = await Promise.all([
      this.prisma.client.verificationEvent.count({ where: { tenantId } }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['result'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { publicId: true, result: true, createdAt: true, method: true },
      }),
      this.prisma.client.aiJob.count({
        where: { verificationEvent: { tenantId }, status: 'COMPLETED' },
      }),
      this.prisma.client.investigation.count({ where: { tenantId, status: 'OPEN' } }),
    ]);

    const resultMap = Object.fromEntries(byResult.map((r) => [r.result, r._count.id]));

    return {
      totalVerifications: total,
      verified: resultMap['VERIFIED'] ?? 0,
      reverified: resultMap['REVERIFIED'] ?? 0,
      suspicious: resultMap['SUSPICIOUS'] ?? 0,
      possibleClone: resultMap['POSSIBLE_CLONE'] ?? 0,
      possibleCounterfeit: resultMap['POSSIBLE_COUNTERFEIT'] ?? 0,
      invalidQr: (resultMap['INVALID_QR'] ?? 0) + (resultMap['UNKNOWN_QR'] ?? 0),
      aiJobsCompleted: aiJobs,
      openInvestigations: investigations,
      recentVerifications: recent,
    };
  }

  async getDailyRollups(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.client.analyticsDaily.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: 'asc' },
      take: days,
    });
  }

  async rollupDaily(tenantId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const events = await this.prisma.client.verificationEvent.findMany({
      where: { tenantId, createdAt: { gte: start, lt: end } },
    });

    const metrics = {
      total: events.length,
      byResult: events.reduce(
        (acc, e) => {
          acc[e.result] = (acc[e.result] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    return this.prisma.client.analyticsDaily.upsert({
      where: { tenantId_date: { tenantId, date: start } },
      create: { tenantId, date: start, metrics },
      update: { metrics },
    });
  }
}
