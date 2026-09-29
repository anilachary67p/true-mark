const REQUEST_TIMEOUT_MS = 20_000;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * In the browser, requests go to the same origin and are proxied to the API by the `/api/*`
 * rewrite in next.config.js. This avoids mixed content and CORS, and works from any device on
 * the network without knowing the API's port.
 */
function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
}

export function resolveVerifyHostname(): string {
  if (process.env.NEXT_PUBLIC_VERIFY_HOSTNAME) return process.env.NEXT_PUBLIC_VERIFY_HOSTNAME;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' ? 'verify.localhost' : host;
  }
  return 'verify.localhost';
}

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

function messageForStatus(status: number): string {
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 404) return 'We could not find this product code.';
  if (status === 400) return 'The code or image you submitted is not valid.';
  if (status === 413) return 'The image is too large. Please use a smaller photo.';
  if (status >= 500) return 'The verification service is temporarily unavailable. Please try again shortly.';
  return `Verification request failed (${status}).`;
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return undefined;
}

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/v1/public${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    throw new PublicApiError(
      err instanceof DOMException && err.name === 'AbortError'
        ? 'The request timed out. Check your connection and try again.'
        : 'Cannot reach the verification service. Check your connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text().catch(() => '');
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const serverMessage = res.status < 500 ? extractMessage(body) : undefined;
    throw new PublicApiError(serverMessage ?? messageForStatus(res.status), res.status);
  }
  if (body === null) throw new PublicApiError('Unexpected response from the verification service.', res.status);
  return body as T;
}

export function postJson<T>(path: string, payload: unknown): Promise<T> {
  return publicRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof PublicApiError ? err.message : fallback;
}

export function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please upload a JPEG, PNG or WebP photo.';
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > MAX_IMAGE_BYTES) return 'The photo is larger than 10 MB. Please use a smaller photo.';
  return null;
}
