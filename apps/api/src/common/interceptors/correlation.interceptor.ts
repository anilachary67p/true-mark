import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CORRELATION_HEADER } from '@truemark/shared';
import { resolveCorrelationId } from '../middleware/correlation.middleware';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (!request.correlationId) {
      request.correlationId = resolveCorrelationId(request.headers[CORRELATION_HEADER]);
      context.switchToHttp().getResponse().setHeader(CORRELATION_HEADER, request.correlationId);
    }
    return next.handle();
  }
}
