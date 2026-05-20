// ---------------------------------------------------------------------------
// products-service / main.ts  —  gRPC microservice entry point  (Step 4+).
//
// THIS IS THE BIG CHANGE FROM STEP 3:
//   Before (Steps 1–3): NestFactory.create()            → HTTP server
//   Now    (Step 4+):   NestFactory.createMicroservice() → gRPC server
//
// Key differences:
//   • No HTTP server is created — no port 3001, no Express adapter.
//   • The transport is gRPC (HTTP/2 + Protocol Buffers binary encoding).
//   • @Get / @Post decorators are irrelevant — only @GrpcMethod() counts.
//   • The service is NEVER called by browsers or curl — only by gRPC clients
//     (the api-gateway will be our client in Step 5).
// ---------------------------------------------------------------------------

import 'reflect-metadata';

// Shared constants from libs/proto (the @app/proto alias resolves to
// libs/proto/src/index.ts — configured in root tsconfig.json `paths`).
//   PRODUCTS_PACKAGE    → 'products' (matches `package products;` in .proto)
//   PRODUCTS_PROTO_PATH → absolute path to products.proto for proto-loader
import { PRODUCTS_PACKAGE, PRODUCTS_PROTO_PATH } from '@app/proto';
import { NestFactory } from '@nestjs/core';
// WHY GrpcOptions and NOT the generic MicroserviceOptions:
//   MicroserviceOptions is a discriminated union of ALL transports (REDIS,
//   KAFKA, TCP, gRPC…). The TypeScript compiler can't narrow `options.package`
//   or `options.protoPath` through that union — they end up typed as `any`,
//   which @typescript-eslint/no-unsafe-assignment rightly flags.
//   GrpcOptions is the SPECIFIC type for gRPC: every field is typed exactly
//   (package: string | string[], protoPath: string | string[], etc.) so
//   our string constants satisfy TypeScript without casting.
import { type GrpcOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

// ---------------------------------------------------------------------------
// gRPC server options extracted to a const so the comments stay flat
// and the createMicroservice() call below stays readable.
// ---------------------------------------------------------------------------
const grpcOptions: GrpcOptions = {
  transport: Transport.GRPC, // selects @grpc/grpc-js as the transport adapter

  options: {
    // Must EXACTLY match `package products;` at the top of products.proto.
    // The gRPC runtime uses this to locate the service inside the loaded proto.
    // `as string`: eslint's project-service can't fully resolve the @app/proto
    // path alias at lint time, so it infers these constants as `any`. The cast
    // is safe — both are plain string exports from libs/proto/src/index.ts.
    package: PRODUCTS_PACKAGE as string,

    // @grpc/proto-loader reads and parses this file at startup to learn the
    // service/method/message shapes. Sharing the path from libs/proto guarantees
    // the server (here) and the client (api-gateway, Step 5) always use the
    // identical contract — a mismatch would cause silent serialization bugs.
    protoPath: PRODUCTS_PROTO_PATH as string,

    // Bind to all interfaces (0.0.0.0) so containers in Docker (Step 8) can
    // reach this service. In dev the gateway connects to localhost:50052.
    url: `0.0.0.0:${process.env.PRODUCTS_GRPC_PORT ?? 50052}`,
  },
};

async function bootstrap() {
  // createMicroservice() — unlike NestFactory.create(), this does NOT start
  // an HTTP server. It wires the gRPC transport layer and registers every
  // @GrpcMethod()-decorated handler found in AppModule's controller tree.
  const app = await NestFactory.createMicroservice<GrpcOptions>(AppModule, grpcOptions);

  // Log every incoming gRPC call and its duration.
  app.useGlobalInterceptors(new LoggingInterceptor());

  // app.listen() for a microservice takes no port argument — the address is
  // already in grpcOptions.options.url above. Resolves once the TCP socket is
  // bound and gRPC is ready to accept RPCs.
  await app.listen();

  console.log(
    `[products-service] gRPC listening on 0.0.0.0:${process.env.PRODUCTS_GRPC_PORT ?? 50052}`,
  );
}

bootstrap();
