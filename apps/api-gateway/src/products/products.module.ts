// ---------------------------------------------------------------------------
// api-gateway / products.module.ts  —  NestJS feature module for Products.
//
// This module owns three things:
//   1. The gRPC CLIENT registration (ClientsModule.register)
//   2. The service that wraps gRPC calls (ProductsClientService)
//   3. The GraphQL resolver (ProductsResolver)
//
// WHY ClientsModule lives here (not in AppModule):
//   ClientsModule.register() creates a named gRPC client scoped to THIS
//   module. Keeping it in the Products feature module makes the dependency
//   explicit — only Products code talks to the products-service. If we add an
//   Orders module later, it registers its own client in its own module.
// ---------------------------------------------------------------------------

// Shared constants from libs/proto.
import { PRODUCTS_PACKAGE, PRODUCTS_PROTO_PATH, PRODUCTS_SERVICE } from '@app/proto';
import { Module } from '@nestjs/common';
// ClientsModule: NestJS utility that sets up named transport clients (gRPC,
//   Redis, NATS, TCP, etc.) and makes them injectable via @Inject(TOKEN).
// Transport: enum of available transports. We use Transport.GRPC.
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { ProductsResolver } from './products.resolver';
import { ProductsClientService } from './products.service';

@Module({
  imports: [
    // AuthModule exports JwtAuthGuard and AuthClientService.
    // Importing it here makes @UseGuards(JwtAuthGuard) work on resolver methods
    // in this module — NestJS can resolve the guard's AuthClientService dependency
    // through the DI container rather than constructing it blindly.
    AuthModule,

    // ClientsModule.register() is where we tell NestJS:
    //   "When something @Inject(PRODUCTS_SERVICE)s, give it a gRPC client
    //    pointed at the products-service."
    //
    // The `name` field becomes the injection token — it MUST match the string
    // passed to @Inject(PRODUCTS_SERVICE) in ProductsClientService.
    ClientsModule.register([
      {
        // Injection token — same value as PRODUCTS_SERVICE = 'PRODUCTS_SERVICE'.
        // Both ends of the DI binding must use the exact same string.
        name: PRODUCTS_SERVICE,

        // Which transport to use. Transport.GRPC tells @nestjs/microservices
        // to create a @grpc/grpc-js channel instead of, say, a TCP socket.
        transport: Transport.GRPC,

        options: {
          // Same package / protoPath as the server side (products-service).
          // WHY the same proto: the client uses it to understand the message
          // shapes and service contract — it must be identical to the server's.
          package: PRODUCTS_PACKAGE,
          protoPath: PRODUCTS_PROTO_PATH,

          // PRODUCTS_GRPC_URL lets the URL be overridden without rebuilding.
          //
          // In dev (no Docker): PRODUCTS_GRPC_URL is unset → falls back to
          //   localhost:50052 (or whatever PRODUCTS_GRPC_PORT is set to).
          //
          // In Docker: docker-compose sets
          //   PRODUCTS_GRPC_URL=products-service:50052
          //   where 'products-service' is Docker's DNS name for the container
          //   (the service name in docker-compose.yml). Containers on the same
          //   Compose network resolve each other by service name automatically.
          //
          // WHY not hardcode 'products-service:50052' here:
          //   The app runs in both dev (localhost) and Docker (DNS name). A
          //   single env var lets you switch context with zero code changes.
          url: process.env.PRODUCTS_GRPC_URL ?? `localhost:${process.env.PRODUCTS_GRPC_PORT ?? 50052}`,
        },
      },
    ]),
  ],

  providers: [
    // ProductsClientService: wraps gRPC calls, converts Observable → Promise.
    ProductsClientService,

    // ProductsResolver: handles GraphQL queries and mutations.
    // NestJS GraphQL finds resolvers automatically when they are in providers[].
    ProductsResolver,
  ],
})
export class ProductsModule {}
