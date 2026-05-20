// ---------------------------------------------------------------------------
// api-gateway/orders/orders.module.ts  —  NestJS feature module for Orders.
// Registers the gRPC client for orders-service, resolver, and service.
// ---------------------------------------------------------------------------

import { ORDERS_PACKAGE, ORDERS_PROTO_PATH, ORDERS_SERVICE } from '@app/proto';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersResolver } from './orders.resolver';
import { OrdersClientService } from './orders.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: ORDERS_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: ORDERS_PACKAGE,
          protoPath: ORDERS_PROTO_PATH,
          // Same URL override pattern as products.module.ts:
          //   Dev (no Docker): falls back to localhost:50052
          //   Docker: docker-compose sets ORDERS_GRPC_URL=orders-service:50052
          //     where 'orders-service' is the Docker DNS name for that container.
          url: process.env.ORDERS_GRPC_URL ?? `localhost:${process.env.ORDERS_GRPC_PORT ?? 50052}`,
        },
      },
    ]),
  ],
  providers: [OrdersClientService, OrdersResolver],
})
export class OrdersModule {}
