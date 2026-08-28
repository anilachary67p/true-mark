import { AiProvider } from '../interfaces';

/** Used when a real provider is configured but credentials are missing. */
export class UnavailableAiProvider implements AiProvider {
  async analyzeImage(
    _image: Buffer,
    _context: { checkType: string; referenceMetadata?: Record<string, unknown> },
  ): Promise<{ confidence: number; passed: boolean; details: Record<string, unknown> }> {
    throw new Error('AI_UNAVAILABLE');
  }

  async extractOcr(
    _image: Buffer,
    _fields: string[],
  ): Promise<Array<{ field: string; value: string; confidence: number }>> {
    throw new Error('AI_UNAVAILABLE');
  }

  async checkImageQuality(image: Buffer) {
    if (image.length < 500) {
      return { clear: false, score: 0.1, reason: 'Image too small' };
    }
    throw new Error('AI_UNAVAILABLE');
  }
}
