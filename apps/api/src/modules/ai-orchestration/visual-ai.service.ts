import { Inject, Injectable, Logger } from '@nestjs/common';
import { ImageViewAngle } from '@truemark/db';
import { AiProvider } from '../../providers/interfaces';
import { AI_PROVIDER } from '../../providers/providers.module';
import { PrismaService } from '../../providers/prisma.service';

export type VisualCheckType = 'packaging' | 'logo' | 'security_features';

export interface VisualCheckResult {
  checkType: VisualCheckType;
  passed: boolean;
  confidence: number;
  details: Record<string, unknown>;
}

@Injectable()
export class VisualAiService {
  private readonly logger = new Logger(VisualAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  getRequiredViews(config: Record<string, unknown> | null | undefined): ImageViewAngle[] {
    const views = config?.requiredViews;
    if (Array.isArray(views) && views.length > 0) {
      return views.filter((v): v is ImageViewAngle =>
        ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'ADDITIONAL'].includes(String(v)),
      );
    }
    return [ImageViewAngle.FRONT, ImageViewAngle.BACK];
  }

  assertRequiredViewsUploaded(
    required: ImageViewAngle[],
    uploaded: ImageViewAngle[],
  ): { ok: boolean; missing: ImageViewAngle[] } {
    const missing = required.filter((v) => !uploaded.includes(v));
    return { ok: missing.length === 0, missing };
  }

  async runVisualChecks(
    tenantId: string,
    imageBuffers: Array<{ viewAngle: ImageViewAngle; buffer: Buffer }>,
    productScopeId?: string | null,
  ): Promise<VisualCheckResult[]> {
    const reference = await this.prisma.client.aiReferenceData.findFirst({
      where: {
        tenantId,
        ...(productScopeId ? { scopeId: productScopeId } : {}),
      },
      orderBy: { version: 'desc' },
    });

    const refMeta = (reference?.metadata as Record<string, unknown>) ?? {};
    const checkTypes: VisualCheckType[] = ['packaging', 'logo', 'security_features'];
    const results: VisualCheckResult[] = [];

    const primary = imageBuffers.find((i) => i.viewAngle === ImageViewAngle.FRONT) ?? imageBuffers[0];
    if (!primary) return results;

    for (const checkType of checkTypes) {
      try {
        const analysis = await this.aiProvider.analyzeImage(primary.buffer, {
          checkType,
          referenceMetadata: refMeta,
        });
        results.push({
          checkType,
          passed: analysis.passed,
          confidence: analysis.confidence,
          details: { ...analysis.details, viewAngle: primary.viewAngle, hasReference: !!reference },
        });
      } catch (err) {
        this.logger.warn(`Visual check ${checkType} unavailable: ${err}`);
        throw err;
      }
    }

    return results;
  }
}
