// ---------------------------------------------------------------------------
// auth-service / main.ts  —  gRPC microservice bootstrap for Auth.
//
// Identical pattern to products-service/main.ts and orders-service/main.ts:
//   • NestFactory.createMicroservice() — no HTTP, pure gRPC
//   • Transport.GRPC with auth.proto
//   • Listens on AUTH_GRPC_PORT (default 50051)
//
// Port assignments (auth comes first as the foundational identity service):
//   auth-service:     50051
//   products-service: 50052
//   orders-service:   50053
//   Each gRPC server needs a unique host port in dev. In Docker each container
//   has its own network namespace, so all could use 50051 internally — the host
//   port mapping is only relevant for direct host-to-container testing.
// ---------------------------------------------------------------------------

import 'reflect-metadata';

import { AUTH_PACKAGE, AUTH_PROTO_PATH } from '@app/proto';
import { NestFactory } from '@nestjs/core';
import { type GrpcOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

const grpcOptions: GrpcOptions = {
  transport: Transport.GRPC,
  options: {
    // `as string` cast: eslint's project-service can't fully resolve the
    // @app/proto alias at lint time and infers these as `any`. The values
    // are plain strings exported from libs/proto/src/index.ts.
    package: AUTH_PACKAGE as string,
    protoPath: AUTH_PROTO_PATH as string,
    url: `0.0.0.0:${process.env.AUTH_GRPC_PORT ?? 50051}`,
  },
};

async function bootstrap() {
  const app = await NestFactory.createMicroservice<GrpcOptions>(AppModule, grpcOptions);

  // Log every incoming gRPC call and its duration.
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen();
  console.log(
    `[auth-service] gRPC listening on 0.0.0.0:${process.env.AUTH_GRPC_PORT ?? 50051}`,
  );
}

bootstrap();
