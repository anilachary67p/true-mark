import { Test, TestingModule } from '@nestjs/testing';
import { ImageViewAngle } from '@truemark/db';
import { VisualAiService } from './visual-ai.service';
import { PrismaService } from '../../providers/prisma.service';
import { AI_PROVIDER } from '../../providers/providers.module';
import { MockAiProvider } from '../../providers/ai/mock-ai.provider';

describe('VisualAiService', () => {
  let service: VisualAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisualAiService,
        { provide: PrismaService, useValue: { client: { aiReferenceData: { findFirst: jest.fn().mockResolvedValue(null) } } } },
        { provide: AI_PROVIDER, useClass: MockAiProvider },
      ],
    }).compile();

    service = module.get(VisualAiService);
  });

  it('defaults required views to FRONT and BACK', () => {
    expect(service.getRequiredViews({})).toEqual([ImageViewAngle.FRONT, ImageViewAngle.BACK]);
  });

  it('reads required views from AI config', () => {
    expect(service.getRequiredViews({ requiredViews: ['FRONT', 'LEFT'] })).toEqual([
      ImageViewAngle.FRONT,
      ImageViewAngle.LEFT,
    ]);
  });

  it('detects missing required views', () => {
    const result = service.assertRequiredViewsUploaded(
      [ImageViewAngle.FRONT, ImageViewAngle.BACK],
      [ImageViewAngle.FRONT],
    );
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(ImageViewAngle.BACK);
  });

  it('runs packaging, logo, and security visual checks', async () => {
    const buffer = Buffer.alloc(2000, 1);
    const results = await service.runVisualChecks('tenant-1', [
      { viewAngle: ImageViewAngle.FRONT, buffer },
    ]);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.checkType)).toEqual(['packaging', 'logo', 'security_features']);
  });
});
