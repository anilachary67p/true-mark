import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_HEADER } from '@truemark/shared';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const correlationId =
      (request.headers[CORRELATION_HEADER] as string) ?? uuidv4();
    request.correlationId = correlationId;
    const response = context.switchToHttp().getResponse();
    response.setHeader(CORRELATION_HEADER, correlationId);
    return next.handle();
  }
}
