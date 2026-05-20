// ---------------------------------------------------------------------------
// api-gateway / auth.resolver.ts  —  GraphQL resolver for the Auth domain.
//
// EXPOSED OPERATIONS:
//
//   Mutations (write / state-changing):
//     register(input: RegisterInput): AuthPayloadType
//       — creates a new account, returns JWT + user profile
//     login(input: LoginInput): AuthPayloadType
//       — authenticates an existing user, returns JWT + user profile
//
//   Query (read):
//     me: TokenPayloadType         [PROTECTED — requires valid JWT]
//       — returns the current user's decoded token payload (userId, email, name)
//       — protected by @UseGuards(JwtAuthGuard): the token is validated via
//         a gRPC call to auth-service before this resolver runs
//
// HOW TO USE THE JWT IN SUBSEQUENT REQUESTS:
//   1. Call `register` or `login` → receive `accessToken`.
//   2. For every protected operation, add the header:
//        Authorization: Bearer <accessToken>
//   3. Call `me` (or any other protected resolver) — the guard will validate
//      the token automatically before the resolver executes.
//
// IN THE APOLLO SANDBOX:
//   Add the header in the "Headers" tab at the bottom of the sandbox:
//     { "Authorization": "Bearer eyJhbGci..." }
// ---------------------------------------------------------------------------

import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthClientService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  AuthPayloadType,
  LoginInput,
  RegisterInput,
  TokenPayloadType,
} from './auth.types';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthClientService) {}

  // ---------------------------------------------------------------------------
  // REGISTER — create a new user account.
  //
  // Returns the JWT immediately so the client can start making authenticated
  // requests without a separate login step after registration.
  //
  // GraphQL:
  //   mutation {
  //     register(input: { email: "alice@example.com", password: "secret", name: "Alice" }) {
  //       accessToken
  //       user { id email name createdAt }
  //     }
  //   }
  // ---------------------------------------------------------------------------
  @Mutation(() => AuthPayloadType)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayloadType> {
    return (await this.authService.register(input)) as AuthPayloadType;
  }

  // ---------------------------------------------------------------------------
  // LOGIN — authenticate an existing user.
  //
  // GraphQL:
  //   mutation {
  //     login(input: { email: "alice@example.com", password: "secret" }) {
  //       accessToken
  //       user { id email name }
  //     }
  //   }
  // ---------------------------------------------------------------------------
  @Mutation(() => AuthPayloadType)
  async login(@Args('input') input: LoginInput): Promise<AuthPayloadType> {
    return (await this.authService.login(input)) as AuthPayloadType;
  }

  // ---------------------------------------------------------------------------
  // ME — return the current user's identity from the JWT.
  //
  // Protected by JwtAuthGuard:
  //   1. Guard runs BEFORE this resolver.
  //   2. Guard extracts Bearer token from Authorization header.
  //   3. Guard calls auth-service.ValidateToken via gRPC.
  //   4. On success, guard writes { userId, email, name } to req.user.
  //   5. This resolver reads req.user from the GraphQL context.
  //
  // @Context() ctx — NestJS injects the GraphQL execution context.
  //   ctx.req       — the underlying Express Request (set by app.module.ts
  //                   via `context: ({ req }) => ({ req })` in GraphQL config).
  //   ctx.req.user  — the TokenPayload set by JwtAuthGuard.canActivate().
  //
  // GraphQL:
  //   query {               ← add header: Authorization: Bearer <token>
  //     me { userId email name }
  //   }
  // ---------------------------------------------------------------------------
  @Query(() => TokenPayloadType)
  @UseGuards(JwtAuthGuard)
  me(@Context() ctx: { req: { user: TokenPayloadType } }): TokenPayloadType {
    // The guard has already validated the token and attached the payload.
    // This resolver just reads it — no async work needed.
    return ctx.req.user;
  }
}
