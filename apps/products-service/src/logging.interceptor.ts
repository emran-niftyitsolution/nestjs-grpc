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
//   → ProductsController.findAll
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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();

    // context.getClass()   — the controller class that will handle this RPC.
    //   .name              — e.g. 'ProductsController'
    // context.getHandler() — the specific method matched to the incoming RPC.
    //   .name              — e.g. 'findAll', 'createProduct', 'listStream'
    //
    // Together they give "ProductsController.findAll" — a label that maps
    // directly to the @GrpcMethod decorator in the controller file, making it
    // easy to find the code being invoked.
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
