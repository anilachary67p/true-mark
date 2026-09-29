import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@truemark/db';
import { CORRELATION_HEADER } from '@truemark/shared';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId?: string;
  timestamp: string;
  path: string;
  [key: string]: unknown;
}

const PRISMA_STATUS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with these values already exists' },
  P2003: { status: HttpStatus.CONFLICT, message: 'Related record constraint failed' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Value too long for field' },
  P2023: { status: HttpStatus.BAD_REQUEST, message: 'Malformed identifier' },
};

/**
 * Normalizes every error into a stable JSON envelope, maps Prisma errors to 4xx,
 * and never leaks stack traces or internal messages for unexpected failures.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    if (response.headersSent) return;

    const correlationId: string | undefined = request.correlationId;
    const base = {
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl?.split('?')[0] ?? request.url,
    };

    const body = this.toBody(exception, base);

    if (body.statusCode >= 500) {
      this.logger.error(
        JSON.stringify({ ...base, method: request.method, status: body.statusCode }),
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (correlationId) response.setHeader(CORRELATION_HEADER, correlationId);
    response.status(body.statusCode).json(body);
  }

  private toBody(
    exception: unknown,
    base: Pick<ErrorBody, 'correlationId' | 'timestamp' | 'path'>,
  ): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { statusCode: status, error: HttpStatus[status] ?? 'Error', message: res, ...base };
      }
      const obj = res as Record<string, unknown>;
      return {
        ...obj,
        statusCode: status,
        error: (obj.error as string) ?? HttpStatus[status] ?? 'Error',
        message: (obj.message as string | string[]) ?? exception.message,
        ...base,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_STATUS[exception.code];
      if (mapped) {
        return {
          statusCode: mapped.status,
          error: HttpStatus[mapped.status],
          message: mapped.message,
          ...base,
        };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid request parameters',
        ...base,
      };
    }

    if (isBodyParserError(exception)) {
      return {
        statusCode: exception.status,
        error: HttpStatus[exception.status] ?? 'Bad Request',
        message:
          exception.type === 'entity.too.large' ? 'Request body too large' : 'Malformed request body',
        ...base,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      ...base,
    };
  }
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { status?: unknown }).status === 'number' &&
    typeof (e as { type?: unknown }).type === 'string' &&
    (e as { status: number }).status >= 400 &&
    (e as { status: number }).status < 500
  );
}
