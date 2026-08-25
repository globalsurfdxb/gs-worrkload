import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const start = performance.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Math.round(performance.now() - start);
        this.logger.log(`${request.method} ${request.originalUrl} +${durationMs}ms`);
      }),
    );
  }
}
