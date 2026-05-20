// ---------------------------------------------------------------------------
// auth-service / db/db.module.ts  —  NestJS module that creates the Drizzle client.
//
// Identical pattern to products-service/db/db.module.ts:
//   1. Read DATABASE_URL from ConfigService (populated from .env by ConfigModule).
//   2. Create a postgres.js connection pool.
//   3. Wrap it in a Drizzle typed client that knows about our schema.
//   4. Export the DRIZZLE_CLIENT token so AuthModule (and AuthService) can inject it.
//
// WHY reuse DATABASE_URL (same connection string as other services):
//   In dev/learning mode all services share one Postgres container. The auth
//   service has its own `users` table and its own migration history — it is
//   logically isolated even though it shares the same connection string.
//   In production each service would have a dedicated DB with its own URL.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DRIZZLE_CLIENT } from './index';
import * as schema from './schema';

@Module({
  providers: [
    {
      provide: DRIZZLE_CLIENT,

      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // ConfigService.getOrThrow throws at startup if the var is missing —
        // much clearer than a cryptic postgres connection error later.
        const url = config.getOrThrow<string>('DATABASE_URL');
        const client = postgres(url);

        // Passing `schema` gives Drizzle full type information: `db.select()
        // .from(users)` returns `User[]` without any manual type annotation.
        return drizzle(client, { schema });
      },
    },
  ],

  // MUST export the token so AuthModule can inject it into AuthService.
  exports: [DRIZZLE_CLIENT],
})
export class DrizzleModule {}
