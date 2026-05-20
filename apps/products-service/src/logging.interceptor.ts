// ---------------------------------------------------------------------------
// products-service / logging.interceptor.ts  —  gRPC call logger.
//
// SAME PATTERN as api-gateway's interceptor, DIFFERENT CONTEXT:
//   api-gateway  context type = 'http' | 'graphql'  → reads req.method / GqlInfo
//   microservice context type = 'rpc'               → reads class/handler names
//
// For a gRPC microservice every incoming call is an RPC, so we don't need to
// branch on context type — we always have exactly one shape to deal with.
//
// WHAT IS LOGGED:
//   → ProductsController.findAll  @20:03:11.423
//   ← ProductsController.findAll  +8ms
//   ✗ ProductsController.findOne  +3ms — Product with id '...' not found
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

// Module-level counter — incremented once per incoming RPC call.
// WHY module-level (not a class field):
//   A class field resets to 0 every time NestJS creates a new interceptor
//   instance. The module scope persists for the lifetime of the process, so
//   the counter keeps incrementing across all requests without a shared store.
//   Node.js is single-threaded so there is no race condition on this increment.
let reqCounter = 0;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    // Capture the counter value for THIS call so both the → and ← lines share
    // the same #N even when concurrent requests interleave in the log output.
    const reqId = ++reqCounter;

    // context.getClass()   — the controller class that will handle this RPC.
    //   .name              — e.g. 'ProductsController'
    // context.getHandler() — the specific method matched to the incoming RPC.
    //   .name              — e.g. 'findAll', 'createProduct', 'listStream'
    //
    // Together they give "ProductsController.findAll" — a label that maps
    // directly to the @GrpcMethod decorator in the controller file, making it
    // easy to find the code being invoked.
    const label = `${context.getClass().name}.${context.getHandler().name}`;

    // toISOString() gives "YYYY-MM-DDTHH:mm:ss.SSSZ" — slice(11,23) extracts
    // "HH:mm:ss.SSS" (UTC). Appended to the entry log so you can see WHEN the
    // call arrived, not just that it did. The exit log shows how long it took.
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
