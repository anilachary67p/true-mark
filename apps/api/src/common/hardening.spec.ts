import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@truemark/db';
import { parsePagination } from './utils/pagination.util';
import { UuidParamsPipe } from './pipes/uuid-params.pipe';
import { resolveCorrelationId } from './middleware/correlation.middleware';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import {
  assertSafeObjectKey,
  assertTenantObjectKey,
} from '../providers/storage/storage-key.util';
import { resolveConsumerHostname } from '../modules/verification/consumer-hostname.util';
import { detectImageFormat } from '../modules/ai-orchestration/ai-orchestration.service';
import { normalizeQrRenderOptions } from '../modules/qr/qr.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

describe('parsePagination', () => {
  it('applies defaults', () => {
    expect(parsePagination(undefined, undefined)).toEqual({ take: 50, skip: 0 });
  });

  it('clamps limit to max', () => {
    expect(parsePagination('10000', '5', { maxLimit: 200 })).toEqual({ take: 200, skip: 5 });
  });

  it.each(['abc', '-1', '1.5', 'NaN'])('rejects invalid value %s', (value) => {
    expect(() => parsePagination(value, undefined)).toThrow(BadRequestException);
    expect(() => parsePagination(undefined, value)).toThrow(BadRequestException);
  });

  it('rejects zero limit', () => {
    expect(() => parsePagination('0', undefined)).toThrow(BadRequestException);
  });
});

describe('UuidParamsPipe', () => {
  const pipe = new UuidParamsPipe();

  it('accepts UUID params', () => {
    expect(pipe.transform(TENANT.toUpperCase(), { type: 'param', data: 'tenantId' })).toBe(TENANT);
  });

  it('rejects malformed id params', () => {
    expect(() => pipe.transform('1 OR 1=1', { type: 'param', data: 'batchId' })).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform('../x', { type: 'param', data: 'id' })).toThrow(BadRequestException);
  });

  it('ignores non-id params and bodies', () => {
    expect(pipe.transform('anything', { type: 'param', data: 'format' })).toBe('anything');
    expect(pipe.transform({ a: 1 }, { type: 'body', data: undefined })).toEqual({ a: 1 });
  });
});

describe('resolveCorrelationId', () => {
  it('keeps well-formed ids', () => {
    expect(resolveCorrelationId('req-12345678')).toBe('req-12345678');
  });

  it('replaces malicious or oversized ids', () => {
    expect(resolveCorrelationId('bad\r\nSet-Cookie: x')).not.toContain('\n');
    expect(resolveCorrelationId('x'.repeat(500))).toHaveLength(36);
    expect(resolveCorrelationId(['a', 'b'])).toHaveLength(36);
  });
});

describe('storage keys', () => {
  it('rejects traversal and absolute keys', () => {
    for (const key of ['../etc/passwd', '/etc/passwd', 'tenants/a/../../b', 'a//b', 'a/./b']) {
      expect(() => assertSafeObjectKey(key)).toThrow(BadRequestException);
    }
  });

  it('enforces tenant namespace', () => {
    expect(() => assertTenantObjectKey(`tenants/${TENANT}/logo.png`, TENANT)).not.toThrow();
    expect(() => assertTenantObjectKey('tenants/other-tenant/logo.png', TENANT)).toThrow(
      BadRequestException,
    );
  });
});

describe('resolveConsumerHostname', () => {
  const req = (headers: Record<string, string>) => ({ headers }) as never;

  it('prefers the browser Origin over a claimed hostname', () => {
    expect(
      resolveConsumerHostname(req({ origin: 'https://verify.brand.com' }), 'verify.competitor.com'),
    ).toBe('verify.brand.com');
  });

  it('honours claimed hostname from local development origins', () => {
    expect(
      resolveConsumerHostname(req({ origin: 'http://localhost:3002' }), 'verify.localhost'),
    ).toBe('verify.localhost');
  });

  it('falls back to forwarded host then Host header', () => {
    expect(resolveConsumerHostname(req({ 'x-forwarded-host': 'verify.brand.com:443' }))).toBe(
      'verify.brand.com',
    );
    expect(resolveConsumerHostname(req({ host: 'Verify.Brand.com' }))).toBe('verify.brand.com');
  });
});

describe('AllExceptionsFilter', () => {
  function run(exception: unknown) {
    const res = {
      headersSent: false,
      statusCode: 0,
      body: undefined as unknown,
      setHeader: jest.fn(),
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x?secret=1', correlationId: 'c-12345678' }),
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(exception, host);
    return res as { statusCode: number; body: Record<string, unknown> };
  }

  it('maps Prisma unique violations to 409', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const res = run(err);
    expect(res.statusCode).toBe(409);
    expect(res.body.correlationId).toBe('c-12345678');
  });

  it('maps Prisma not-found to 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: 'x' });
    expect(run(err).statusCode).toBe(404);
  });

  it('preserves HttpException status and message', () => {
    const res = run(new NotFoundException('Tenant not found'));
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Tenant not found');
  });

  it('hides internal error details and strips query strings from path', () => {
    const res = run(new Error('connection string postgres://user:pass@host'));
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('postgres://');
    expect(res.body.path).toBe('/api/v1/x');
  });
});

describe('detectImageFormat', () => {
  it('detects jpeg, png and webp by magic bytes', () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.contentType).toBe('image/jpeg');
    expect(
      detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.contentType,
    ).toBe('image/png');
    expect(detectImageFormat(Buffer.from('RIFF0000WEBPVP8 ', 'ascii'))?.contentType).toBe('image/webp');
  });

  it('rejects non-images', () => {
    expect(detectImageFormat(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe('normalizeQrRenderOptions', () => {
  it('clamps oversized widths and rejects invalid colors', () => {
    const opts = normalizeQrRenderOptions({
      width: 50_000,
      quietZone: -5,
      foregroundColor: 'red; drop table',
      errorCorrectionLevel: 'Z',
    });
    expect(opts.width).toBe(2048);
    expect(opts.margin).toBe(0);
    expect(opts.color.dark).toBe('#000000');
    expect(opts.errorCorrectionLevel).toBe('M');
  });
});
