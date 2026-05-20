// ---------------------------------------------------------------------------
// auth-service / auth.module.ts  —  feature module for the Auth domain.
//
// Dependency graph:
//
//   AuthModule
//   ├── DrizzleModule  → provides DRIZZLE_CLIENT (users table queries)
//   ├── JwtModule      → provides JwtService (sign + verify tokens)
//   ├── AuthController ← registers @GrpcMethod handlers (Register, Login, ValidateToken)
//   └── AuthService    ← business logic (password hashing, JWT signing, DB queries)
//
// JWT CONFIGURATION:
//   JwtModule.register() is the static (synchronous) registration variant.
//   We read JWT_SECRET directly from process.env here — the same pattern used
//   elsewhere in this project for inline env reads (e.g. gRPC URLs in module files).
//
//   WHY a fallback secret for dev:
//     Running the service locally without a .env set up shouldn't immediately
//     crash with a config error. The fallback makes `bun run start:auth` work
//     out-of-the-box. The string "dev-secret-CHANGE-IN-PRODUCTION" is obviously
//     not safe for real deployments — the .env and docker-compose both set a
//     real JWT_SECRET.
//
//   expiresIn: '1d' — tokens expire after 24 hours. The client must re-login
//     (or you can add a refresh token flow later). Short-lived tokens limit
//     the damage if a token is leaked.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DrizzleModule } from '../db/db.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    // DrizzleModule exports DRIZZLE_CLIENT — AuthService injects it for DB access.
    DrizzleModule,

    // JwtModule.register() creates a JwtService with a fixed secret + options.
    // JwtService.sign(payload)   → produces a signed JWT string.
    // JwtService.verify(token)   → verifies signature + expiry, returns payload.
    JwtModule.register({
      // JWT_SECRET is the HMAC-SHA256 signing key.
      // In development: use the .env value or the hardcoded fallback.
      // In production: ALWAYS set JWT_SECRET to a strong random value (32+ bytes).
      //   Generate one: `openssl rand -hex 32`
      secret: process.env.JWT_SECRET ?? 'dev-secret-CHANGE-IN-PRODUCTION',

      signOptions: {
        // All tokens expire in 24 hours. After expiry, ValidateToken throws
        // UNAUTHENTICATED and the client must re-authenticate.
        expiresIn: '1d',
      },
    }),
  ],

  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
