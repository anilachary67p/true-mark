import { AiProvider } from '../interfaces';

/**
 * OpenAI-compatible vision provider.
 * Requires AI_API_KEY. Never fabricates confidence in production when the API fails.
 */
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_MODEL ?? 'gpt-4o-mini',
  ) {}

  async checkImageQuality(image: Buffer) {
    if (image.length < 500) {
      return { clear: false, score: 0.15, reason: 'Image too small or corrupted' };
    }
    return { clear: true, score: 0.85 };
  }

  async extractOcr(image: Buffer, fields: string[]) {
    const base64 = image.toString('base64');
    const prompt = `Extract these product packaging fields as JSON keys: ${fields.join(', ')}. Return JSON only.`;

    const response = await this.callVision(base64, prompt);
    try {
      const parsed = JSON.parse(response) as Record<string, string>;
      return fields.map((field) => ({
        field,
        value: String(parsed[field] ?? ''),
        confidence: parsed[field] ? 0.75 : 0.2,
      }));
    } catch {
      return fields.map((field) => ({ field, value: '', confidence: 0 }));
    }
  }

  async analyzeImage(
    image: Buffer,
    context: { checkType: string; referenceMetadata?: Record<string, unknown> },
  ) {
    const base64 = image.toString('base64');
    const prompt = `Analyze product packaging for check "${context.checkType}". Respond JSON: {"passed":boolean,"confidence":0-1,"notes":"..."}`;
    const raw = await this.callVision(base64, prompt);
    try {
      const parsed = JSON.parse(raw) as { passed?: boolean; confidence?: number; notes?: string };
      return {
        passed: parsed.passed ?? false,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
        details: { checkType: context.checkType, notes: parsed.notes, provider: 'openai' },
      };
    } catch {
      return { passed: false, confidence: 0, details: { checkType: context.checkType, provider: 'openai', parseError: true } };
    }
  }

  private async callVision(base64: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      throw new Error('AI_UNAVAILABLE');
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content ?? '{}';
  }
}
