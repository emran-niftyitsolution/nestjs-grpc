// ---------------------------------------------------------------------------
// products.module.ts  —  feature module grouping Products controller + service.
//
// WHY A FEATURE MODULE (not just registering in AppModule directly):
//   NestJS encourages "feature modules" — one module per domain concept
//   (Products, Orders, Users…). Each module:
//     • Imports only what IT needs (here: DrizzleModule for the DB client)
//     • Declares its own controller + service
//     • AppModule just imports feature modules — it stays thin
//
//   This means in Step 7 when we add Orders, we create OrdersModule the same
//   way and AppModule just gets one more import line. The structure scales.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/db.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    // DrizzleModule exports DRIZZLE_CLIENT. Importing it here makes that
    // provider available for injection in ProductsService (constructor injection).
    // ConfigModule is NOT imported here — it was registered globally (isGlobal:
    // true) in AppModule, so ConfigService is available everywhere without
    // re-importing.
    DrizzleModule,
  ],
  controllers: [
    // ProductsController declares @GrpcMethod handlers — Nest registers those
    // as gRPC routes when the microservice starts.
    ProductsController,
  ],
  providers: [
    // ProductsService holds the business logic. It is injectable into the
    // controller via constructor injection. `providers` registers it in the DI
    // container scoped to this module.
    ProductsService,
  ],
})
export class ProductsModule {}
