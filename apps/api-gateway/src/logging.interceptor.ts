// ---------------------------------------------------------------------------
// logging.interceptor.ts  —  global request/response logger for api-gateway.
//
// WHAT IS AN INTERCEPTOR?
//   In NestJS, an interceptor wraps around every handler (resolver method or
//   controller method). It runs code BEFORE the handler executes and AFTER
//   it completes (or errors). Think of it as middleware that understands
//   NestJS's execution contexts (HTTP, GraphQL, gRPC).
//
//   Lifecycle for a single request:
//     interceptor.before → handler executes → interceptor.after
//
// WHY A GLOBAL INTERCEPTOR (not decorators on each resolver/controller):
//   A @UseInterceptors() decorator on every method would work, but you'd have
//   to remember to add it to every new resolver. Registering once globally in
//   main.ts covers everything automatically — existing and future handlers.
//
// WHAT THIS LOGS:
//   For GraphQL (queries/mutations):
//     → GraphQL query     products          (before)
//     ← GraphQL query     products   +12ms  (after, success)
//     ✗ GraphQL mutation  createProduct +5ms — Product not found  (after, error)
//
//   For HTTP (REST routes like GET /health):
//     → HTTP GET /health
//     ← HTTP GET /health +1ms
// ---------------------------------------------------------------------------

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
// GqlExecutionContext: NestJS's GraphQL-aware wrapper around ExecutionContext.
//   Lets us reach into the GraphQL layer and read the operation type and field
//   name from the resolver info — things not available on the raw HTTP context.
import { GqlExecutionContext } from '@nestjs/graphql';
import { type Observable } from 'rxjs';
// tap: RxJS operator that runs side-effect callbacks without changing the
//   stream's values. Perfect for logging: we observe what happened without
//   interfering with the response data flowing through the pipeline.
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // Logger('API') — NestJS's built-in structured logger.
  //   The string 'API' is the context label shown in brackets:
  //     [Nest] 12345  LOG [API] → GraphQL query products
  //   Using Logger (not console.log) means the output respects NestJS's log
  //   level configuration and formats consistently with Nest's own messages.
  private readonly logger = new Logger('API');

  // intercept() is called by NestJS for every incoming request.
  //   context  — describes WHAT is being handled (GraphQL? HTTP? which method?)
  //   next     — a handle to the actual handler function. Calling next.handle()
  //              executes the resolver / controller method and returns an
  //              Observable of the result. We must call it or the request hangs.
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();

    // Build a human-readable label BEFORE the handler runs so the "→" log
    // line appears before any handler output (db queries, gRPC calls, etc.).
    const label = this.buildLabel(context);

    // Log the incoming call.
    this.logger.log(`→ ${label}`);

    // next.handle() returns an Observable that:
    //   - emits the handler's return value on success
    //   - errors if the handler throws
    //
    // tap({ next, error }) attaches two observers:
    //   next  — called when the handler successfully returns a value
    //   error — called when the handler throws (RpcException, Error, etc.)
    // Neither callback changes the stream — they're pure side-effects.
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`← ${label}  +${Date.now() - start}ms`),
        error: (err: Error) =>
          this.logger.error(`✗ ${label}  +${Date.now() - start}ms — ${err.message}`),
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // buildLabel — extracts a readable name from the execution context.
  //
  // context.getType() returns 'http' | 'graphql' | 'rpc'.
  //   'graphql' — resolver method (@Query / @Mutation)
  //   'http'    — controller method (@Get, @Post, etc.)
  //   'rpc'     — gRPC handler (only relevant in the microservices, not here)
  // ---------------------------------------------------------------------------
  private buildLabel(context: ExecutionContext): string {
    if (context.getType<string>() === 'graphql') {
      // GqlExecutionContext wraps the raw context and gives GraphQL-specific
      // accessors. getInfo() returns GraphQL's ResolveInfo object which has:
      //   info.operation.operation — 'query' | 'mutation' | 'subscription'
      //   info.fieldName           — the resolver name, e.g. 'products', 'createProduct'
      const gqlCtx = GqlExecutionContext.create(context);
      const info = gqlCtx.getInfo<{ fieldName: string; operation: { operation: string } }>();
      const op = info.operation?.operation ?? 'query';

      // Right-pad the operation type so field names line up vertically in logs:
      //   → GraphQL query     products
      //   → GraphQL mutation  createProduct
      const opPadded = op.padEnd(9);
      return `GraphQL ${opPadded} ${info.fieldName}`;
    }

    // HTTP context — available on the Express request object.
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    return `HTTP    ${req.method.padEnd(6)} ${req.url}`;
  }
}
