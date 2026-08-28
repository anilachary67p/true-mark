import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';
import {
  DateRange,
  eachDayInRange,
  metricDelta,
  previousDateRange,
  toDateKey,
} from '../../common/utils/date-range.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformDashboard(range: DateRange) {
    const prev = previousDateRange(range);
    const dateFilter = { createdAt: { gte: range.from, lte: range.to } };
    const prevDateFilter = { createdAt: { gte: prev.from, lte: prev.to } };

    const suspiciousResults = ['SUSPICIOUS', 'POSSIBLE_CLONE', 'POSSIBLE_COUNTERFEIT'] as const;

    const [
      tenants,
      tenantCountPrev,
      totalCurrent,
      totalPrev,
      byResultCurrent,
      byResultPrev,
      volumeEvents,
      prevVolumeEvents,
      openInvestigations,
      prevOpenInvestigations,
      catalogCounts,
      prevCatalogCounts,
      tenantsWithEvents,
      prevTenantsWithEvents,
      byTenantCurrent,
      byTenantPrev,
      deploymentGroups,
    ] = await Promise.all([
      this.prisma.client.tenant.findMany({
        select: { id: true, name: true, status: true, deploymentType: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.tenant.count({
        where: { createdAt: { lte: prev.to } },
      }),
      this.prisma.client.verificationEvent.count({ where: dateFilter }),
      this.prisma.client.verificationEvent.count({ where: prevDateFilter }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['result'],
        where: dateFilter,
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['result'],
        where: prevDateFilter,
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.findMany({
        where: dateFilter,
        select: { createdAt: true },
      }),
      this.prisma.client.verificationEvent.findMany({
        where: prevDateFilter,
        select: { createdAt: true },
      }),
      this.prisma.client.investigation.count({ where: { status: 'OPEN' } }),
      this.prisma.client.investigation.count({
        where: { status: 'OPEN', createdAt: { lte: prev.to } },
      }),
      Promise.all([
        this.prisma.client.category.count({ where: { createdAt: { lte: range.to } } }),
        this.prisma.client.productType.count({ where: { createdAt: { lte: range.to } } }),
        this.prisma.client.productVariant.count({ where: { createdAt: { lte: range.to } } }),
        this.prisma.client.tag.count({ where: { createdAt: { lte: range.to } } }),
      ]),
      Promise.all([
        this.prisma.client.category.count({ where: { createdAt: { lte: prev.to } } }),
        this.prisma.client.productType.count({ where: { createdAt: { lte: prev.to } } }),
        this.prisma.client.productVariant.count({ where: { createdAt: { lte: prev.to } } }),
        this.prisma.client.tag.count({ where: { createdAt: { lte: prev.to } } }),
      ]),
      this.prisma.client.verificationEvent.groupBy({
        by: ['tenantId'],
        where: dateFilter,
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['tenantId'],
        where: prevDateFilter,
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['tenantId', 'result'],
        where: dateFilter,
        _count: { id: true },
      }),
      this.prisma.client.verificationEvent.groupBy({
        by: ['tenantId', 'result'],
        where: prevDateFilter,
        _count: { id: true },
      }),
      this.prisma.client.tenant.groupBy({
        by: ['deploymentType'],
        _count: { id: true },
      }),
    ]);

    const resultMap = Object.fromEntries(byResultCurrent.map((r) => [r.result, r._count.id]));
    const prevResultMap = Object.fromEntries(byResultPrev.map((r) => [r.result, r._count.id]));

    const verifiedCurrent = resultMap['VERIFIED'] ?? 0;
    const verifiedPrev = prevResultMap['VERIFIED'] ?? 0;
    const suspiciousCurrent = suspiciousResults.reduce((s, r) => s + (resultMap[r] ?? 0), 0);
    const suspiciousPrev = suspiciousResults.reduce((s, r) => s + (prevResultMap[r] ?? 0), 0);

    const tenantEventMap = Object.fromEntries(
      tenantsWithEvents.map((t) => [t.tenantId, t._count.id]),
    );
    const prevTenantEventMap = Object.fromEntries(
      prevTenantsWithEvents.map((t) => [t.tenantId, t._count.id]),
    );

    const tenantResultMap = new Map<string, Record<string, number>>();
    for (const row of byTenantCurrent) {
      const entry = tenantResultMap.get(row.tenantId) ?? {};
      entry[row.result] = row._count.id;
      tenantResultMap.set(row.tenantId, entry);
    }

    const tenantCatalog = await Promise.all(
      tenants.map(async (tenant) => {
        const [categories, productTypes, variants, tags] = await Promise.all([
          this.prisma.client.category.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.productType.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.productVariant.count({ where: { tenantId: tenant.id } }),
          this.prisma.client.tag.count({ where: { tenantId: tenant.id } }),
        ]);
        const results = tenantResultMap.get(tenant.id) ?? {};
        const verifications = tenantEventMap[tenant.id] ?? 0;
        const verified = results['VERIFIED'] ?? 0;
        const suspicious = suspiciousResults.reduce((s, r) => s + (results[r] ?? 0), 0);
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: tenant.status,
          deploymentType: tenant.deploymentType,
          verifications,
          verified,
          suspicious,
          verificationRate: verifications > 0 ? Math.round((verified / verifications) * 1000) / 10 : 0,
          catalog: { categories, productTypes, variants, tags },
        };
      }),
    );

    return {
      dateRange: { from: range.from.toISOString(), to: range.to.toISOString() },
      previousDateRange: { from: prev.from.toISOString(), to: prev.to.toISOString() },
      totals: {
        tenants: metricDelta(tenants.length, tenantCountPrev),
        verifications: metricDelta(totalCurrent, totalPrev),
        verified: metricDelta(verifiedCurrent, verifiedPrev),
        suspicious: metricDelta(suspiciousCurrent, suspiciousPrev),
        categories: metricDelta(catalogCounts[0], prevCatalogCounts[0]),
        productTypes: metricDelta(catalogCounts[1], prevCatalogCounts[1]),
        variants: metricDelta(catalogCounts[2], prevCatalogCounts[2]),
        tags: metricDelta(catalogCounts[3], prevCatalogCounts[3]),
        openInvestigations: metricDelta(openInvestigations, prevOpenInvestigations),
        activeTenants: metricDelta(
          tenantsWithEvents.length,
          prevTenantsWithEvents.length,
        ),
      },
      dailyVolume: this.buildDailyVolume(volumeEvents, range),
      previousDailyVolume: this.buildDailyVolume(prevVolumeEvents, prev),
      resultDistribution: byResultCurrent.map((r) => ({
        result: r.result,
        count: r._count.id,
        previous: prevResultMap[r.result] ?? 0,
      })),
      tenantsByDeployment: deploymentGroups.map((g) => ({
        deploymentType: g.deploymentType,
        count: g._count.id,
      })),
      tenantBreakdown: tenantCatalog.sort((a, b) => b.verifications - a.verifications),
    };
  }

  async getPlatformTenantDashboard(tenantId: string, range: DateRange) {
    const dashboard = await this.getDashboard(tenantId, range);
    const prev = previousDateRange(range);
    const prevDashboard = await this.getDashboard(tenantId, prev);
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true, deploymentType: true },
    });
    const [categories, productTypes, variants, tags] = await Promise.all([
      this.prisma.client.category.count({ where: { tenantId } }),
      this.prisma.client.productType.count({ where: { tenantId } }),
      this.prisma.client.productVariant.count({ where: { tenantId } }),
      this.prisma.client.tag.count({ where: { tenantId } }),
    ]);

    const suspiciousCurrent =
      Number(dashboard.suspicious ?? 0) + Number(dashboard.possibleClone ?? 0);
    const suspiciousPrev =
      Number(prevDashboard.suspicious ?? 0) + Number(prevDashboard.possibleClone ?? 0);

    return {
      tenant,
      dateRange: dashboard.dateRange,
      previousDateRange: { from: prev.from.toISOString(), to: prev.to.toISOString() },
      catalog: { categories, productTypes, variants, tags },
      totals: {
        verifications: metricDelta(
          Number(dashboard.totalVerifications ?? 0),
          Number(prevDashboard.totalVerifications ?? 0),
        ),
        verified: metricDelta(Number(dashboard.verified ?? 0), Number(prevDashboard.verified ?? 0)),
        suspicious: metricDelta(suspiciousCurrent, suspiciousPrev),
        aiJobsCompleted: metricDelta(
          Number(dashboard.aiJobsCompleted ?? 0),
          Number(prevDashboard.aiJobsCompleted ?? 0),
        ),
        openInvestigations: metricDelta(
          Number(dashboard.openInvestigations ?? 0),
          Number(prevDashboard.openInvestigations ?? 0),
        ),
      },
      dailyVolume: dashboard.dailyVolume,
      previousDailyVolume: prevDashboard.dailyVolume,
      dashboard,
    };
  }

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
