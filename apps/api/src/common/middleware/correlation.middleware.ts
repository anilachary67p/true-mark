import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_HEADER } from '@truemark/shared';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveCorrelationId(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && SAFE_CORRELATION_ID.test(value) ? value : randomUUID();
}

/**
 * Runs before guards and pipes so every response (including auth/validation errors)
 * carries a correlation id. Untrusted client ids are only accepted if well-formed.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = resolveCorrelationId(req.headers[CORRELATION_HEADER]);
  (req as Request & { correlationId: string }).correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  next();
}
