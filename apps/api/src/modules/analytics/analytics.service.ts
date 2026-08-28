import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';
import { DateRange, eachDayInRange, toDateKey } from '../../common/utils/date-range.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, range: DateRange) {
    const dateFilter = { createdAt: { gte: range.from, lte: range.to } };

    const [total, byResult, recent, aiJobs, investigations, volumeEvents] = await Promise.all([
      this.prisma.client.verificationEvent.count({ where: { tenantId, ...dateFilter } }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['result'],
        where: { tenantId, ...dateFilter },
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.findMany({
        where: { tenantId, ...dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { publicId: true, result: true, createdAt: true, method: true },
      }),
      this.prisma.client.aiJob.count({
        where: {
          verificationEvent: { tenantId, ...dateFilter },
          status: 'COMPLETED',
        },
      }),
      this.prisma.client.investigation.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.client.verificationEvent.findMany({
        where: { tenantId, ...dateFilter },
        select: { createdAt: true },
      }),
    ]);

    const resultMap = Object.fromEntries(byResult.map((r) => [r.result, r._count.id]));
    const dailyVolume = this.buildDailyVolume(volumeEvents, range);

    return {
      dateRange: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      totalVerifications: total,
      verified: resultMap['VERIFIED'] ?? 0,
      reverified: resultMap['REVERIFIED'] ?? 0,
      suspicious: resultMap['SUSPICIOUS'] ?? 0,
      possibleClone: resultMap['POSSIBLE_CLONE'] ?? 0,
      possibleCounterfeit: resultMap['POSSIBLE_COUNTERFEIT'] ?? 0,
      invalidQr: (resultMap['INVALID_QR'] ?? 0) + (resultMap['UNKNOWN_QR'] ?? 0),
      aiJobsCompleted: aiJobs,
      openInvestigations: investigations,
      dailyVolume,
      recentVerifications: recent,
    };
  }

  async getDailyRollups(tenantId: string, range: DateRange) {
    return this.prisma.client.analyticsDaily.findMany({
      where: { tenantId, date: { gte: range.from, lte: range.to } },
      orderBy: { date: 'asc' },
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

  private buildDailyVolume(events: Array<{ createdAt: Date }>, range: DateRange) {
    const counts = new Map<string, number>();
    for (const day of eachDayInRange(range.from, range.to)) {
      counts.set(toDateKey(day), 0);
    }
    for (const event of events) {
      const key = toDateKey(event.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }
}
