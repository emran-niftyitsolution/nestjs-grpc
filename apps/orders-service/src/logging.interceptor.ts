// ---------------------------------------------------------------------------
// orders-service / logging.interceptor.ts  —  gRPC call logger.
//
// Identical to products-service/logging.interceptor.ts.
// Kept as a separate file (rather than a shared lib) so each service is
// self-contained — you can read either service's source without jumping to
// another package to understand what's running inside it.
//
// WHAT IS LOGGED:
//   → OrdersController.findAll  @20:03:11.423
//   ← OrdersController.findAll  +6ms
//   → OrdersController.createOrder  @20:03:11.500
//   ← OrdersController.createOrder  +52ms   (includes the S2S gRPC call to products-service)
//   ✗ OrdersController.createOrder  +4ms — Product with id '...' not found
// ---------------------------------------------------------------------------

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Per-process request counter — see products-service/logging.interceptor.ts
// for the full explanation of why this lives at module scope.
let reqCounter = 0;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const reqId = ++reqCounter;
    const label = `${context.getClass().name}.${context.getHandler().name}`;

    this.logger.log(`#${reqId} → ${label}  @${new Date().toISOString().slice(11, 23)}`);

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`#${reqId} ← ${label}  +${Date.now() - start}ms`),
        error: (err: Error) =>
          this.logger.error(`#${reqId} ✗ ${label}  +${Date.now() - start}ms — ${err.message}`),
      }),
    );
  }
}
