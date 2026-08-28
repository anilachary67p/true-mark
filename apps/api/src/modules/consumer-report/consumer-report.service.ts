import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma.service';
import { DomainService } from '../domain/domain.service';

@Injectable()
export class ConsumerReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainService: DomainService,
  ) {}

  async create(
    hostname: string,
    data: { reason: string; comment?: string; verificationPublicId?: string },
    ipAddress?: string,
  ) {
    const domain = await this.domainService.resolveTenantByHostname(hostname);
    if (!domain) {
      return { success: false, message: 'Unable to submit report' };
    }

    let verificationEventId: string | undefined;
    if (data.verificationPublicId) {
      const event = await this.prisma.client.verificationEvent.findFirst({
        where: { publicId: data.verificationPublicId, tenantId: domain.tenantId },
      });
      verificationEventId = event?.id;
    }

    const report = await this.prisma.client.consumerReport.create({
      data: {
        tenantId: domain.tenantId,
        verificationEventId,
        reason: data.reason,
        comment: data.comment,
        ipAddress,
      },
    });

    return { success: true, reportId: report.id };
  }
}
