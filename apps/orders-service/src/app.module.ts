// ---------------------------------------------------------------------------
// orders-service/app.module.ts  —  root module for the orders gRPC microservice.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    // Load .env first — OrdersModule's DrizzleModule needs DATABASE_URL,
    // and OrdersModule's ClientsModule needs PRODUCTS_GRPC_PORT.
    ConfigModule.forRoot({ isGlobal: true }),
    OrdersModule,
  ],
})
export class AppModule {}
