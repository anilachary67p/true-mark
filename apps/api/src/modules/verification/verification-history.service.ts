import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';

@Injectable()
export class VerificationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      productUnitId?: string;
      result?: string;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = options.offset ?? 0;
    const where = {
      tenantId,
      ...(options.productUnitId ? { productUnitId: options.productUnitId } : {}),
      ...(options.result ? { result: options.result as never } : {}),
      ...(options.from || options.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.verificationEvent.findMany({
        where,
        include: {
          location: true,
          fraudSignals: true,
          productUnit: { include: { serial: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.client.verificationEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        publicId: e.publicId,
        result: e.result,
        method: e.method,
        riskLevel: e.riskLevel,
        correlationId: e.correlationId,
        createdAt: e.createdAt,
        serial: e.productUnit?.serial?.serialNumber,
        productSnapshot: e.productSnapshot,
        fraudSignalCount: e.fraudSignals.length,
        location: e.location
          ? { country: e.location.country, city: e.location.city, source: e.location.source }
          : null,
      })),
      total,
      limit,
      offset,
    };
  }
}
