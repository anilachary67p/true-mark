import { AiProvider } from '../interfaces';

export class MockAiProvider implements AiProvider {
  async analyzeImage(
    _image: Buffer,
    context: { checkType: string; referenceMetadata?: Record<string, unknown> },
  ) {
    return {
      confidence: 0.85,
      passed: true,
      details: { checkType: context.checkType, provider: 'mock' },
    };
  }

  async extractOcr(_image: Buffer, fields: string[]) {
    return fields.map((field) => ({
      field,
      value: `MOCK_${field.toUpperCase()}`,
      confidence: 0.9,
    }));
  }

  async checkImageQuality(image: Buffer) {
    if (image.length < 1000) {
      return { clear: false, score: 0.2, reason: 'Image too small or corrupted' };
    }
    return { clear: true, score: 0.9 };
  }
}
