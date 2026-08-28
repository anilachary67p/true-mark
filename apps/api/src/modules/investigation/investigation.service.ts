import { Injectable, NotFoundException } from '@nestjs/common';
import { InvestigationStatus } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InvestigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, title: string, description: string | undefined, userId: string) {
    const inv = await this.prisma.client.investigation.create({
      data: {
        tenantId,
        title,
        description,
        investigatorId: userId,
        status: InvestigationStatus.OPEN,
        events: { create: { status: InvestigationStatus.OPEN, note: 'Investigation opened' } },
      },
      include: { events: true },
    });
    await this.audit.log({
      action: 'INVESTIGATION_CREATED',
      resourceType: 'investigation',
      resourceId: inv.id,
      tenantId,
      userId,
      after: inv,
    });
    return inv;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: InvestigationStatus,
    note: string | undefined,
    userId: string,
  ) {
    const inv = await this.prisma.client.investigation.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('Investigation not found');

    const updated = await this.prisma.client.investigation.update({
      where: { id },
      data: {
        status,
        events: { create: { status, note } },
      },
      include: { events: true },
    });

    await this.audit.log({
      action: status === InvestigationStatus.CONFIRMED_COUNTERFEIT ? 'COUNTERFEIT_CONFIRMED' : 'FRAUD_STATUS_CHANGED',
      resourceType: 'investigation',
      resourceId: id,
      tenantId,
      userId,
      before: inv,
      after: updated,
    });

    return updated;
  }

  async list(tenantId: string) {
    return this.prisma.client.investigation.findMany({
      where: { tenantId },
      include: { events: true, investigator: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
