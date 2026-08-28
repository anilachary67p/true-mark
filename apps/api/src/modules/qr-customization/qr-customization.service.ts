import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class QrCustomizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActive(tenantId: string, scope = 'tenant', scopeId?: string) {
    return this.prisma.client.qrCustomizationConfig.findFirst({
      where: { tenantId, scope, scopeId: scopeId ?? null, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async upsert(
    tenantId: string,
    config: Record<string, unknown>,
    userId: string,
    scope = 'tenant',
    scopeId?: string,
  ) {
    const existing = await this.getActive(tenantId, scope, scopeId);
    const version = (existing?.version ?? 0) + 1;

    if (existing) {
      await this.prisma.client.qrCustomizationConfig.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }

    const created = await this.prisma.client.qrCustomizationConfig.create({
      data: {
        tenantId,
        scope,
        scopeId,
        version,
        config: config as object,
        isActive: true,
      },
    });

    await this.audit.log({
      action: 'QR_CUSTOMIZATION_CHANGED',
      resourceType: 'qr_customization',
      resourceId: created.id,
      tenantId,
      userId,
      after: created,
    });

    return created;
  }
}
