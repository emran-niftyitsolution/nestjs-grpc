// ---------------------------------------------------------------------------
// auth-service / logging.interceptor.ts  —  gRPC call logger.
//
// Identical pattern to products-service and orders-service interceptors.
// Kept as a separate file (not a shared lib) so each service is self-contained.
//
// WHAT IS LOGGED:
//   → AuthController.register
//   ← AuthController.register  +312ms   (includes bcrypt hashing ~250ms)
//   → AuthController.login
//   ← AuthController.login     +265ms
//   → AuthController.validateToken
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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const label = `${context.getClass().name}.${context.getHandler().name}`;

    this.logger.log(`→ ${label}`);

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`← ${label}  +${Date.now() - start}ms`),
        error: (err: Error) =>
          this.logger.error(`✗ ${label}  +${Date.now() - start}ms — ${err.message}`),
      }),
    );
  }
}
