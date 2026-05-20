// ---------------------------------------------------------------------------
// api-gateway / auth.module.ts  —  NestJS feature module for the Auth domain.
//
// This module owns three things (same pattern as ProductsModule / OrdersModule):
//   1. The gRPC CLIENT registration (ClientsModule.register)
//   2. The service that wraps gRPC calls (AuthClientService)
//   3. The GraphQL resolver (AuthResolver)
//   4. The JWT guard (JwtAuthGuard) — declared in providers so DI can inject
//      AuthClientService into it
//
// The gRPC client connects to auth-service on port 50053 (default for dev).
// In Docker, AUTH_GRPC_URL is set to 'auth-service:50053' by docker-compose
// so Docker's internal DNS routes to the right container.
// ---------------------------------------------------------------------------

import { AUTH_PACKAGE, AUTH_PROTO_PATH, AUTH_SERVICE } from '@app/proto';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { AuthResolver } from './auth.resolver';
import { AuthClientService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    // Register the gRPC client for auth-service.
    // AUTH_SERVICE is the injection token — injected in AuthClientService
    // constructor with @Inject(AUTH_SERVICE).
    ClientsModule.register([
      {
        name: AUTH_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: AUTH_PACKAGE,
          protoPath: AUTH_PROTO_PATH,

          // AUTH_GRPC_URL lets the URL be overridden for Docker without code changes.
          // Dev:    AUTH_GRPC_URL unset → falls back to localhost:50053
          // Docker: docker-compose sets AUTH_GRPC_URL=auth-service:50053
          url: process.env.AUTH_GRPC_URL ?? `localhost:${process.env.AUTH_GRPC_PORT ?? 50053}`,
        },
      },
    ]),
  ],

  providers: [
    // AuthClientService wraps gRPC calls and is injected into the resolver AND guard.
    AuthClientService,

    // AuthResolver handles GraphQL register/login mutations and `me` query.
    AuthResolver,

    // JwtAuthGuard is declared as a provider so NestJS DI can inject
    // AuthClientService into its constructor. Without this, using @UseGuards()
    // on resolver methods would fail because the guard would be constructed
    // outside the DI container (without its dependencies).
    JwtAuthGuard,
  ],

  // Export both so OTHER modules (ProductsModule, OrdersModule, etc.) can import
  // AuthModule and use @UseGuards(JwtAuthGuard) on their resolvers without
  // re-registering the gRPC client or the guard in each feature module.
  //
  // WHY export the service too:
  //   JwtAuthGuard depends on AuthClientService. When another module imports
  //   AuthModule, it gets both the guard AND its dependency resolved — you don't
  //   have to worry about the DI chain.
  exports: [JwtAuthGuard, AuthClientService],
})
export class AuthModule {}
