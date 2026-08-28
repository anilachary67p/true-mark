import { Injectable, NotFoundException } from '@nestjs/common';
import { AiMode } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string) {
    return this.prisma.client.aiConfig.findUnique({
      where: { tenantId },
      include: { referenceData: true },
    });
  }

  async update(
    tenantId: string,
    data: { mode?: AiMode; quota?: number; config?: object },
    userId: string,
  ) {
    const updated = await this.prisma.client.aiConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        mode: data.mode ?? AiMode.AI_DISABLED,
        quota: data.quota ?? 1000,
        config: data.config ?? {},
      },
      update: { mode: data.mode, quota: data.quota, config: data.config },
    });
    await this.audit.log({
      action: updated.mode === AiMode.AI_DISABLED ? 'AI_DISABLED' : 'TENANT_CONFIGURATION_CHANGED',
      resourceType: 'ai_config',
      resourceId: updated.id,
      tenantId,
      userId,
      after: { mode: updated.mode, quota: updated.quota },
    });
    return updated;
  }

  async createReferenceData(
    tenantId: string,
    data: { scope?: string; scopeId?: string; objectKey: string; metadata?: object },
    userId: string,
  ) {
    const config = await this.prisma.client.aiConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('AI config not found');

    const ref = await this.prisma.client.aiReferenceData.create({
      data: {
        aiConfigId: config.id,
        tenantId,
        scope: data.scope ?? 'product',
        scopeId: data.scopeId,
        objectKey: data.objectKey,
        metadata: data.metadata ?? {},
      },
    });

    await this.audit.log({
      action: 'AI_REFERENCE_DATA_CREATED',
      resourceType: 'ai_reference_data',
      resourceId: ref.id,
      tenantId,
      userId,
      after: ref,
    });

    return ref;
  }

  async deleteReferenceData(tenantId: string, referenceId: string, userId: string) {
    const ref = await this.prisma.client.aiReferenceData.findFirst({
      where: { id: referenceId, tenantId },
    });
    if (!ref) throw new NotFoundException('Reference data not found');

    await this.prisma.client.aiReferenceData.delete({ where: { id: referenceId } });
    await this.audit.log({
      action: 'AI_REFERENCE_DATA_DELETED',
      resourceType: 'ai_reference_data',
      resourceId: referenceId,
      tenantId,
      userId,
    });
    return { deleted: true };
  }

  async getUsageCount(tenantId: string): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return this.prisma.client.aiJob.count({
      where: {
        verificationEvent: { tenantId },
        createdAt: { gte: start },
        status: { in: ['COMPLETED', 'PROCESSING', 'PENDING'] },
      },
    });
  }

  async assertQuotaAvailable(tenantId: string): Promise<void> {
    const config = await this.get(tenantId);
    if (!config) return;
    const used = await this.getUsageCount(tenantId);
    if (used >= config.quota) {
      throw new NotFoundException('AI quota exceeded for this billing period');
    }
  }
}
