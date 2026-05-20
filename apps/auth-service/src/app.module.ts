// ---------------------------------------------------------------------------
// auth-service / app.module.ts  —  root module of the auth gRPC microservice.
//
// Dependency graph:
//
//   AppModule
//   ├── ConfigModule  [global]  → provides ConfigService everywhere
//   └── AuthModule
//       ├── DrizzleModule → provides DRIZZLE_CLIENT (uses ConfigService internally)
//       ├── JwtModule     → provides JwtService (JWT sign + verify)
//       ├── AuthController ← registers @GrpcMethod handlers
//       └── AuthService    ← business logic
//
// Identical structure to products-service/app.module.ts and orders-service/app.module.ts.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ConfigModule.forRoot loads .env into process.env and makes ConfigService
    // injectable globally. Must come before AuthModule because DrizzleModule
    // (inside AuthModule) injects ConfigService to read DATABASE_URL.
    ConfigModule.forRoot({ isGlobal: true }),

    // The Auth domain: gRPC handlers + JWT + password hashing + DB queries.
    AuthModule,
  ],
})
export class AppModule {}
