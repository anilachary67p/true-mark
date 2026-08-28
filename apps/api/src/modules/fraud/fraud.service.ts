import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  async getSignals(tenantId: string, limit = 50) {
    return this.prisma.client.fraudSignal.findMany({
      where: { verificationEvent: { tenantId } },
      include: {
        verificationEvent: {
          select: { publicId: true, result: true, createdAt: true, productUnitId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getHotspots(tenantId: string) {
    const [byResult, bySignal] = await Promise.all([
      this.prisma.client.verificationEvent.groupBy({
        by: ['result'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.client.fraudSignal.groupBy({
        by: ['signalType'],
        where: { verificationEvent: { tenantId } },
        _count: { id: true },
      }),
    ]);
    return { byResult, bySignalType: bySignal };
  }

  async getAlerts(tenantId: string, limit = 20) {
    return this.prisma.client.fraudSignal.findMany({
      where: {
        verificationEvent: { tenantId },
        severity: { in: ['HIGH', 'MEDIUM'] },
      },
      include: {
        verificationEvent: {
          select: { publicId: true, result: true, createdAt: true, correlationId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getConfig(tenantId: string) {
    return this.prisma.client.fraudConfig.findUnique({ where: { tenantId } });
  }

  async updateConfig(
    tenantId: string,
    data: {
      highScanCount?: number;
      highScanWindowMinutes?: number;
      maxTravelSpeedKmh?: number;
      impossibleTravelMinutes?: number;
    },
  ) {
    return this.prisma.client.fraudConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        highScanCount: data.highScanCount ?? 50,
        highScanWindowMinutes: data.highScanWindowMinutes ?? 30,
        maxTravelSpeedKmh: data.maxTravelSpeedKmh ?? 900,
        impossibleTravelMinutes: data.impossibleTravelMinutes ?? 60,
      },
      update: data,
    });
  }

  async getSummary(tenantId: string) {
    const signals = await this.getSignals(tenantId, 200);
    const highSeverity = signals.filter((s) => s.severity === 'HIGH').length;
    const mediumSeverity = signals.filter((s) => s.severity === 'MEDIUM').length;
    const cloneSignals = signals.filter(
      (s) => s.signalType === 'HIGH_SCAN_FREQUENCY' || s.signalType === 'EXCESSIVE_QR_REUSE',
    ).length;
    const travelSignals = signals.filter(
      (s) => s.signalType === 'IMPOSSIBLE_TRAVEL' || s.signalType === 'GEOGRAPHIC_ANOMALY',
    ).length;

    const riskScore = Math.min(
      100,
      highSeverity * 15 + mediumSeverity * 5 + cloneSignals * 10 + travelSignals * 12,
    );

    return {
      totalSignals: signals.length,
      highSeverity,
      mediumSeverity,
      cloneSignals,
      travelSignals,
      riskScore,
      riskLevel: riskScore >= 70 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW',
    };
  }
}
