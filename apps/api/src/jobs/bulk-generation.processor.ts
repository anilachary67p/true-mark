import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { BulkJobStatus, LifecycleStatus } from '@truemark/db';
import { PrismaService } from '../providers/prisma.service';
import { CredentialService } from '../modules/credential/credential.service';
import { DomainService } from '../modules/domain/domain.service';
import { QrService } from '../modules/qr/qr.service';
import { UnitGenerationService } from '../modules/product/unit-generation.service';
import { ProductService } from '../modules/product/product.service';

@Injectable()
@Processor('bulk-generation')
export class BulkGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
    private readonly domainService: DomainService,
    private readonly qrService: QrService,
    private readonly unitGeneration: UnitGenerationService,
    private readonly productService: ProductService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; tenantId: string; batchId: string; quantity: number; serialPrefix: string }>) {
    const { jobId, tenantId, batchId, quantity, serialPrefix } = job.data;
    this.logger.log(`Starting bulk generation: ${quantity} units for batch ${batchId}`);

    await this.prisma.client.bulkJob.update({
      where: { id: jobId },
      data: { status: BulkJobStatus.PROCESSING },
    });

    try {
      const domain = await this.domainService.getActivePrimaryDomain(tenantId);
      const hostname = domain?.hostname ?? 'verify.localhost';
      const path = domain?.verificationPath ?? '/v';
      const domainVersion = domain?.version ?? 1;

      const batchSize = 500;
      let processed = 0;
      let startIndex = await this.productService.getBatchUnitCount(tenantId, batchId);

      for (let offset = 0; offset < quantity; offset += batchSize) {
        const chunk = Math.min(batchSize, quantity - offset);
        const records = await this.unitGeneration.generateUnits(
          tenantId,
          batchId,
          chunk,
          serialPrefix,
          startIndex,
        );
        startIndex += chunk;

        for (const record of records) {
          const qrToken = this.credentialService.generateQrToken();
          await this.qrService.createForUnit(
            tenantId,
            record.productUnitId,
            qrToken,
            hostname,
            path,
            domainVersion,
            1,
          );
        }

        processed += chunk;
        await this.prisma.client.bulkJob.update({
          where: { id: jobId },
          data: { processed },
        });
      }

      await this.prisma.client.batch.updateMany({
        where: { id: batchId, tenantId, status: LifecycleStatus.DRAFT },
        data: { status: LifecycleStatus.ACTIVE },
      });

      await this.prisma.client.bulkJob.update({
        where: { id: jobId },
        data: { status: BulkJobStatus.COMPLETED, processed: quantity, completedAt: new Date() },
      });

      this.logger.log(`Bulk generation completed: ${quantity} units`);
    } catch (error) {
      this.logger.error(`Bulk generation failed: ${error}`);
      await this.prisma.client.bulkJob.update({
        where: { id: jobId },
        data: { status: BulkJobStatus.FAILED, errorMessage: String(error) },
      });
      throw error;
    }
  }
}

@Injectable()
@Processor('analytics-rollup')
export class AnalyticsRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRollupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('analytics-rollup') private readonly rollupQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ tenantId?: string; date?: string }>) {
    if (job.name === 'schedule-daily') {
      const tenants = await this.prisma.client.tenant.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        select: { id: true },
      });
      const date = new Date().toISOString().slice(0, 10);
      for (const tenant of tenants) {
        await this.rollupQueue.add('rollup-tenant', { tenantId: tenant.id, date });
      }
      this.logger.log(`Scheduled rollups for ${tenants.length} tenants (${date})`);
      return { tenants: tenants.length, date };
    }

    const { tenantId, date } = job.data;
    if (!tenantId || !date) return;

    const d = new Date(date);
    const start = new Date(d);
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

    await this.prisma.client.analyticsDaily.upsert({
      where: { tenantId_date: { tenantId, date: start } },
      create: { tenantId, date: start, metrics },
      update: { metrics },
    });
  }
}
