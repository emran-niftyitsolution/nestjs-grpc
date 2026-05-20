// ---------------------------------------------------------------------------
// auth-service / logging.interceptor.ts  —  gRPC call logger.
//
// Identical pattern to products-service and orders-service interceptors.
// Kept as a separate file (not a shared lib) so each service is self-contained.
//
// WHAT IS LOGGED:
//   → AuthController.register  @20:03:11.423
//   ← AuthController.register  +312ms   (includes bcrypt hashing ~250ms)
//   → AuthController.login  @20:03:11.500
//   ← AuthController.login     +265ms
//   → AuthController.validateToken  @20:03:11.800
//   ← AuthController.validateToken  +1ms   (pure CPU, no I/O)
//   ✗ AuthController.login  +2ms — Invalid email or password
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
