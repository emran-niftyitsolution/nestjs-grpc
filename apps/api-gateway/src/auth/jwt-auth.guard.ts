// ---------------------------------------------------------------------------
// api-gateway / jwt-auth.guard.ts  —  NestJS guard that enforces JWT authentication.
//
// WHAT IS A GUARD?
//   A guard is a class that implements CanActivate. NestJS runs it before the
//   route handler / resolver. If canActivate() returns false (or throws), the
//   request is rejected with 401 Unauthorized. If it returns true, execution
//   continues to the resolver.
//
//   Usage (on a resolver method):
//     @UseGuards(JwtAuthGuard)
//     @Query(() => TokenPayloadType)
//     me(@Context() ctx): TokenPayloadType { return ctx.req.user; }
//
// HOW IT WORKS:
//   1. Extract the Bearer token from the Authorization header.
//   2. Call auth-service.ValidateToken via gRPC — the secret never leaves
//      auth-service, so the gateway doesn't need to know it.
//   3. On success, attach the decoded payload to req.user so resolvers can
//      access `ctx.req.user.userId`, `ctx.req.user.email`, etc.
//   4. On failure (missing / expired / invalid token), throw UnauthorizedException.
//
// CONTEXT TYPE HANDLING:
//   GraphQL requests go through Apollo and the execution context type is
//   'graphql', not 'http'. We use GqlExecutionContext to get the underlying
//   Express request from the GraphQL context. For plain HTTP routes (like
//   GET /health), the context type is 'http' and we use switchToHttp().
// ---------------------------------------------------------------------------

import type { TokenPayload } from '@app/proto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AuthClientService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // [Guard] log prefix mirrors the numbered flow diagrams in the README.
  // Each log line corresponds to a numbered step in the auth flow.
  private readonly logger = new Logger('Guard');

  constructor(
    // AuthClientService wraps the gRPC ValidateToken call.
    // DI provides it because the guard is in the same module as the service.
    private readonly authService: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── Step: Extract the token ───────────────────────────────────────────────
    this.logger.log('extracting Bearer token from Authorization header');
    const token = this.extractToken(context);

    if (!token) {
      // No Authorization header or missing Bearer prefix.
      // Throwing gives a clear "401 Unauthorized" rather than a silent false.
      this.logger.warn('✗ no Bearer token found — rejecting request');
      throw new UnauthorizedException('No authentication token provided');
    }

    this.logger.log(`Bearer token found (${token.slice(0, 20)}...)`);

    // ── Step: Validate via auth-service gRPC ─────────────────────────────────
    // WHY we call gRPC instead of verifying locally:
    //   The JWT secret lives only in auth-service. The gateway never sees it.
    //   This keeps the secret isolated to one service even as the system grows.
    this.logger.log('→ auth-service.ValidateToken (gRPC) — verifying token');
    let payload: TokenPayload;
    try {
      payload = await this.authService.validateToken(token);
    } catch {
      // auth-service returns UNAUTHENTICATED for expired / invalid tokens.
      // Re-throw as UnauthorizedException so NestJS produces the right HTTP/GraphQL error.
      this.logger.warn('✗ token validation failed — invalid or expired');
      throw new UnauthorizedException('Invalid or expired token');
    }

    // ── Step: Attach payload to the request ──────────────────────────────────
    // req.user is a well-known convention. Resolvers access it via:
    //   @Context() ctx  →  ctx.req.user.userId
    this.logger.log(`✓ token valid — userId=${payload.userId} email=${payload.email}`);
    const req = this.getRequest(context);
    (req as Record<string, unknown>).user = payload;

    return true;
  }

  // ---------------------------------------------------------------------------
  // getRequest — resolves the underlying Express request regardless of context type.
  //
  // WHY check getType():
  //   NestJS runs the same guard class in multiple contexts.
  //   'graphql' — Apollo/NestJS wraps the Express req inside a GQL context object.
  //   'http'    — standard Express req is directly accessible.
  //   Without branching, GqlExecutionContext.create(context).getContext().req
  //   would be undefined for HTTP routes.
  // ---------------------------------------------------------------------------
  private getRequest(context: ExecutionContext): object {
    if (context.getType<string>() === 'graphql') {
      // GqlExecutionContext.create() gives access to GraphQL-specific metadata.
      // .getContext().req is the original Express Request object.
      return GqlExecutionContext.create(context).getContext<{ req: object }>().req;
    }
    return context.switchToHttp().getRequest<object>();
  }

  // ---------------------------------------------------------------------------
  // extractToken — parses the Bearer token from the Authorization header.
  //
  // Expected header format:   Authorization: Bearer eyJhbGci...
  // Returns null if:
  //   - The header is missing
  //   - The header doesn't start with 'Bearer '
  //   - The token part is empty
  // ---------------------------------------------------------------------------
  private extractToken(context: ExecutionContext): string | null {
    const req = this.getRequest(context) as { headers?: { authorization?: string } };
    const authHeader = req.headers?.authorization;

    if (!authHeader?.startsWith('Bearer ')) return null;

    // Slice off "Bearer " (7 characters) to get the raw JWT string.
    const token = authHeader.slice(7);
    return token || null;
  }
}
