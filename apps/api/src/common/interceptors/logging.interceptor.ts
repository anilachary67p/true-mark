import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const method: string = request.method;
    const path: string = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const start = Date.now();

    const entry = (statusCode: number) => ({
      method,
      path,
      statusCode,
      durationMs: Date.now() - start,
      correlationId: request.correlationId ?? 'unknown',
      userId: request.user?.id,
      tenantId: request.tenantId,
    });

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(JSON.stringify(entry(http.getResponse().statusCode))),
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          const line = JSON.stringify(entry(status));
          if (status >= 500) this.logger.error(line);
          else this.logger.warn(line);
        },
      }),
    );
  }
}
