// ---------------------------------------------------------------------------
// orders-service / logging.interceptor.ts  —  gRPC call logger.
//
// Identical to products-service/logging.interceptor.ts.
// Kept as a separate file (rather than a shared lib) so each service is
// self-contained — you can read either service's source without jumping to
// another package to understand what's running inside it.
//
// WHAT IS LOGGED:
//   → OrdersController.findAll
//   ← OrdersController.findAll  +6ms
//   → OrdersController.createOrder
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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const label = `${context.getClass().name}.${context.getHandler().name}`;

    this.logger.log(`→ ${label}`);

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`← ${label}  +${Date.now() - start}ms`),
        error: (err: Error) =>
          this.logger.error(`✗ ${label}  +${Date.now() - start}ms — ${err.message}`),
      }),
    );
  }
}
