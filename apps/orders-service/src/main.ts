// ---------------------------------------------------------------------------
// orders-service/main.ts  —  gRPC microservice bootstrap for Orders.
//
// Identical pattern to products-service/main.ts:
//   • NestFactory.createMicroservice() — no HTTP, pure gRPC
//   • Transport.GRPC with orders.proto
//   • Listens on ORDERS_GRPC_PORT (default 50052)
//
// WHY port 50052 (not 50051):
//   products-service already owns 50051. Each gRPC server needs a unique port
//   on the host. 50051 and 50052 are both conventional gRPC ports.
//   In Docker (Step 8), each container gets its own network namespace so
//   both could use 50051 internally — the host port is only for dev.
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
    url: `0.0.0.0:${process.env.ORDERS_GRPC_PORT ?? 50052}`,
  },
};

async function bootstrap() {
  const app = await NestFactory.createMicroservice<GrpcOptions>(AppModule, grpcOptions);

  // Log every incoming gRPC call and its duration.
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen();
  console.log(
    `[orders-service] gRPC listening on 0.0.0.0:${process.env.ORDERS_GRPC_PORT ?? 50052}`,
  );
}

bootstrap();
