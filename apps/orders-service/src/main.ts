// ---------------------------------------------------------------------------
// orders-service/main.ts  —  gRPC microservice bootstrap for Orders.
//
// Identical pattern to products-service/main.ts:
//   • NestFactory.createMicroservice() — no HTTP, pure gRPC
//   • Transport.GRPC with orders.proto
//   • Listens on ORDERS_GRPC_PORT (default 50053)
//
// Port assignments:
//   auth-service:     50051
//   products-service: 50052
//   orders-service:   50053  ← this file
//   In Docker each container has its own network namespace so all could use
//   50051 internally — the host port is only relevant for direct dev testing.
// ---------------------------------------------------------------------------

import 'reflect-metadata';

import { ORDERS_PACKAGE, ORDERS_PROTO_PATH } from '@app/proto';
import { NestFactory } from '@nestjs/core';
import { type GrpcOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

const grpcOptions: GrpcOptions = {
  transport: Transport.GRPC,
  options: {
    package: ORDERS_PACKAGE as string,
    protoPath: ORDERS_PROTO_PATH as string,
    url: `0.0.0.0:${process.env.ORDERS_GRPC_PORT ?? 50053}`,
  },
};

async function bootstrap() {
  const app = await NestFactory.createMicroservice<GrpcOptions>(AppModule, grpcOptions);

  // Log every incoming gRPC call and its duration.
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen();
  console.log(
    `[orders-service] gRPC listening on 0.0.0.0:${process.env.ORDERS_GRPC_PORT ?? 50053}`,
  );
}

bootstrap();
