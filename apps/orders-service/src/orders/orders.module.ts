// ---------------------------------------------------------------------------
// orders-service/orders/orders.module.ts
//
// This module does something unique in this project: it registers BOTH a gRPC
// server handler (via OrdersController) AND a gRPC client (via ClientsModule),
// pointing at products-service. This makes orders-service a participant in TWO
// gRPC relationships simultaneously:
//
//   api-gateway  ──[gRPC server]──►  orders-service
//   orders-service ──[gRPC client]──►  products-service
// ---------------------------------------------------------------------------

import {
  ORDERS_PROTO_PATH,
  PRODUCTS_PACKAGE,
  PRODUCTS_PROTO_PATH,
  PRODUCTS_SERVICE,
} from '@app/proto';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { DrizzleModule } from '../db/db.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// Suppress unused-import warning — ORDERS_PROTO_PATH is referenced via the
// package re-export from @app/proto and used in main.ts, not here.
void ORDERS_PROTO_PATH;

@Module({
  imports: [
    // The Drizzle DB client — orders-service needs to read/write the orders table.
    DrizzleModule,

    // ClientsModule registers the gRPC client that orders-service uses to
    // CALL products-service. This is the client side of the S2S call.
    //
    // WHY products-service details live in orders-service's module:
    //   The dependency is explicit and local. If orders-service is deployed
    //   separately, it needs to know how to reach products-service regardless
    //   of what api-gateway does. Each service owns its own client registrations.
    ClientsModule.register([
      {
        name: PRODUCTS_SERVICE, // injection token used in OrdersService constructor
        transport: Transport.GRPC,
        options: {
          package: PRODUCTS_PACKAGE,
          protoPath: PRODUCTS_PROTO_PATH,
          // PRODUCTS_GRPC_URL override: same pattern as api-gateway uses.
          // Dev (no Docker):  localhost:50051 (PRODUCTS_GRPC_PORT fallback)
          // Docker: docker-compose sets PRODUCTS_GRPC_URL=products-service:50051
          url: process.env.PRODUCTS_GRPC_URL ?? `localhost:${process.env.PRODUCTS_GRPC_PORT ?? 50051}`,
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
