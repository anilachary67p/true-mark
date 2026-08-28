import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';

export interface AuditListFilters {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    tenantId?: string;
    userId?: string;
    before?: unknown;
    after?: unknown;
    correlationId?: string;
    ipAddress?: string;
  }) {
    const sanitize = (data: unknown) => {
      if (!data || typeof data !== 'object') return data;
      const copy = { ...(data as Record<string, unknown>) };
      delete copy.password;
      delete copy.passwordHash;
      delete copy.token;
      delete copy.tokenHash;
      delete copy.refreshToken;
      return copy;
    };

    return this.prisma.client.auditLog.create({
      data: {
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        tenantId: params.tenantId,
        userId: params.userId,
        before: sanitize(params.before) as object | undefined,
        after: sanitize(params.after) as object | undefined,
        correlationId: params.correlationId,
        ipAddress: params.ipAddress,
      },
    });
  }

  async listForTenant(tenantId: string, filters: AuditListFilters = {}) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const where = {
      tenantId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}
