// ---------------------------------------------------------------------------
// app.module.ts  —  root module of the products gRPC microservice.
//
// Dependency graph (who provides what to whom):
//
//   AppModule
//   ├── ConfigModule  [global]  → provides ConfigService everywhere
//   └── ProductsModule
//       ├── DrizzleModule → provides DRIZZLE_CLIENT (uses ConfigService internally)
//       ├── ProductsController  ← registers @GrpcMethod handlers
//       └── ProductsService     ← business logic, injects DRIZZLE_CLIENT
//
// WHY no `controllers: []` in AppModule:
//   Controllers are declared inside their feature module (ProductsModule).
//   AppModule imports ProductsModule and that brings the controllers with it.
//   Keeping AppModule lean (just imports, no direct controllers/providers)
//   is the NestJS recommended pattern for anything beyond trivial apps.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    // Load .env into process.env and make ConfigService injectable globally.
    // Must be first — DrizzleModule (via ProductsModule) needs DATABASE_URL.
    ConfigModule.forRoot({ isGlobal: true }),

    // The Products domain: gRPC handlers + business logic + DB queries.
    ProductsModule,
  ],
  // No controllers or providers at the root level — they live in ProductsModule.
})
export class AppModule {}
