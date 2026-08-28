import { AiProvider } from '../interfaces';

/** Proxies AI calls to a cloud gateway when core runs on-premises (Pattern A). */
export class GatewayAiProvider implements AiProvider {
  constructor(private readonly gatewayUrl: string) {}

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error('AI_UNAVAILABLE');
    }
    return res.json() as Promise<T>;
  }

  async checkImageQuality(image: Buffer) {
    return this.post<{ clear: boolean; score: number; reason?: string }>('/v1/quality', {
      image: image.toString('base64'),
    });
  }

  async extractOcr(image: Buffer, fields: string[]) {
    return this.post<Array<{ field: string; value: string; confidence: number }>>('/v1/ocr', {
      image: image.toString('base64'),
      fields,
    });
  }

  async analyzeImage(
    image: Buffer,
    context: { checkType: string; referenceMetadata?: Record<string, unknown> },
  ) {
    return this.post<{ confidence: number; passed: boolean; details: Record<string, unknown> }>(
      '/v1/analyze',
      {
        image: image.toString('base64'),
        checkType: context.checkType,
        referenceMetadata: context.referenceMetadata,
      },
    );
  }
}
