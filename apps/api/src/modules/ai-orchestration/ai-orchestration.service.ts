import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AiJobStatus, AiMode, ImageViewAngle } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { AiProvider, ObjectStorageProvider } from '../../providers/interfaces';
import { AI_PROVIDER, STORAGE_PROVIDER } from '../../providers/providers.module';
import { AiConfigService } from '../ai-config/ai-config.service';
import { VisualAiService } from './visual-ai.service';
import { HybridBoundaryService } from '../hybrid/hybrid-boundary.service';

@Injectable()
export class AiOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly visualAi: VisualAiService,
    private readonly hybridBoundary: HybridBoundaryService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: ObjectStorageProvider,
  ) {}

  async initiate(verificationPublicId: string) {
    const event = await this.prisma.client.verificationEvent.findFirst({
      where: { publicId: verificationPublicId },
    });
    if (!event) throw new NotFoundException('Verification not found');

    const tenantId = event.tenantId;
    const config = await this.aiConfig.get(tenantId);
    if (!config || config.mode === AiMode.AI_DISABLED) {
      return {
        status: AiJobStatus.AI_NOT_CONFIGURED,
        message: 'Additional physical AI validation is not enabled for this product.',
      };
    }

    try {
      await this.aiConfig.assertQuotaAvailable(tenantId);
    } catch {
      return { status: AiJobStatus.AI_UNAVAILABLE, message: 'AI quota exceeded for this period.' };
    }

    const boundary = await this.hybridBoundary.canTransferConsumerImages(tenantId);
    if (!boundary.allowed) {
      return {
        status: AiJobStatus.AI_NOT_CONFIGURED,
        message: boundary.reason ?? 'AI validation is not permitted for this deployment boundary.',
      };
    }

    const providerName = process.env.AI_PROVIDER ?? 'mock';
    if (providerName !== 'mock' && !process.env.AI_API_KEY) {
      return { status: AiJobStatus.AI_NOT_CONFIGURED, message: 'AI provider is not configured.' };
    }

    const job = await this.prisma.client.aiJob.create({
      data: { verificationEventId: event.id, status: AiJobStatus.PENDING, provider: providerName },
    });

    const requiredViews = this.visualAi.getRequiredViews(config.config as Record<string, unknown>);

    return {
      jobId: job.id,
      status: job.status,
      requiredViews,
      aiMode: config.mode,
    };
  }

  private async requireJob(jobId: string) {
    const job = await this.prisma.client.aiJob.findFirst({
      where: { id: jobId },
      include: { images: true, verificationEvent: true },
    });
    if (!job) throw new NotFoundException('AI job not found');
    return job;
  }

  async uploadImage(jobId: string, viewAngle: ImageViewAngle, imageBuffer: Buffer) {
    const job = await this.requireJob(jobId);
    const tenantId = job.verificationEvent.tenantId;
    const boundary = await this.hybridBoundary.canTransferConsumerImages(tenantId);
    if (!boundary.allowed) {
      return {
        status: AiJobStatus.AI_NOT_CONFIGURED,
        message: boundary.reason ?? 'AI image upload is not permitted for this deployment boundary.',
      };
    }

    try {
      const quality = await this.aiProvider.checkImageQuality(imageBuffer);
      if (!quality.clear) {
        await this.prisma.client.aiJob.update({
          where: { id: jobId },
          data: {
            status: AiJobStatus.IMAGE_NOT_CLEAR,
            errorMessage: quality.reason ?? 'Image is not clear enough',
          },
        });
        return {
          status: AiJobStatus.IMAGE_NOT_CLEAR,
          message: 'Image is not clear enough. Please retake or upload a clearer image.',
        };
      }

      const ref = await this.storage.upload(`${tenantId}/${jobId}/${viewAngle}.jpg`, imageBuffer, {
        contentType: 'image/jpeg',
        tenantId,
      });

      await this.prisma.client.aiImage.create({
        data: { aiJobId: jobId, viewAngle, objectKey: ref.key, quality: quality as object },
      });

      await this.hybridBoundary.recordCrossBoundaryTransfer({
        tenantId,
        resourceType: 'ai_image',
        resourceId: jobId,
        classification: boundary.classification,
        direction: 'outbound',
      });

      return { status: 'UPLOADED', viewAngle, qualityScore: quality.score };
    } catch (err) {
      if (String(err).includes('AI_UNAVAILABLE')) {
        return { status: AiJobStatus.AI_UNAVAILABLE, message: 'AI validation is temporarily unavailable.' };
      }
      throw err;
    }
  }

  async processJob(jobId: string) {
    const job = await this.requireJob(jobId);
    const tenantId = job.verificationEvent.tenantId;
    const aiConfig = await this.aiConfig.get(tenantId);
    const requiredViews = this.visualAi.getRequiredViews(aiConfig?.config as Record<string, unknown>);
    const uploadedViews = job.images.map((i) => i.viewAngle);
    const viewCheck = this.visualAi.assertRequiredViewsUploaded(requiredViews, uploadedViews);

    if (!viewCheck.ok) {
      return {
        status: AiJobStatus.PENDING,
        message: `Missing required images: ${viewCheck.missing.join(', ')}`,
        missingViews: viewCheck.missing,
      };
    }

    await this.prisma.client.aiJob.update({
      where: { id: jobId },
      data: { status: AiJobStatus.PROCESSING },
    });

    try {
      const imageBuffers = await Promise.all(
        job.images.map(async (image) => ({
          viewAngle: image.viewAngle,
          buffer: await this.storage.download(image.objectKey),
        })),
      );

      const snapshot = job.verificationEvent.productSnapshot as Record<string, string> | null;
      let totalConfidence = 0;
      let checks = 0;

      for (const image of imageBuffers) {
        const ocrFields = ['batch', 'serial'];
        const ocrResults = await this.aiProvider.extractOcr(image.buffer, ocrFields);

        for (const ocr of ocrResults) {
          const expected =
            ocr.field === 'batch'
              ? snapshot?.batch
              : ocr.field === 'serial'
                ? snapshot?.serial
                : snapshot?.[ocr.field];
          const isMatch = expected ? ocr.value.toUpperCase().includes(String(expected).toUpperCase()) : true;
          await this.prisma.client.aiOcrResult.create({
            data: {
              aiJobId: jobId,
              fieldName: ocr.field,
              extracted: ocr.value,
              expected: expected ?? null,
              isMatch,
              confidence: ocr.confidence,
            },
          });
          if (!isMatch && expected) {
            await this.prisma.client.aiFieldMismatch.create({
              data: { aiJobId: jobId, fieldName: ocr.field, expected, actual: ocr.value },
            });
          }
        }
      }

      const visualResults = await this.visualAi.runVisualChecks(tenantId, imageBuffers, null);
      for (const visual of visualResults) {
        await this.prisma.client.aiVisualResult.create({
          data: {
            aiJobId: jobId,
            checkType: visual.checkType,
            passed: visual.passed,
            confidence: visual.confidence,
            details: visual.details as object,
          },
        });
        totalConfidence += visual.confidence;
        checks++;
      }

      const confidence = checks > 0 ? totalConfidence / checks : 0;
      await this.prisma.client.aiJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.COMPLETED,
          confidence,
          completedAt: new Date(),
          configVersion: aiConfig?.config ? 1 : undefined,
          model: process.env.AI_PROVIDER === 'mock' ? 'mock-v1' : (process.env.AI_MODEL ?? 'unknown'),
          result: {
            confidence,
            visualChecks: visualResults.length,
            disclaimer: 'AI confidence is probabilistic evidence, not proof of authenticity.',
          },
        },
      });

      return {
        status: AiJobStatus.COMPLETED,
        confidence,
        visualResults: visualResults.map((v) => ({ type: v.checkType, passed: v.passed, confidence: v.confidence })),
        disclaimer: 'AI confidence is probabilistic evidence, not proof of authenticity.',
      };
    } catch (error) {
      const unavailable = String(error).includes('AI_UNAVAILABLE');
      await this.prisma.client.aiJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.AI_UNAVAILABLE,
          errorMessage: String(error),
        },
      });
      return { status: AiJobStatus.AI_UNAVAILABLE, message: unavailable ? 'AI validation unavailable.' : undefined };
    }
  }

  async getStatus(jobId: string) {
    const job = await this.requireJob(jobId);
    return this.prisma.client.aiJob.findFirst({
      where: { id: job.id },
      include: { ocrResults: true, fieldMismatches: true, visualResults: true, images: true },
    });
  }
}
