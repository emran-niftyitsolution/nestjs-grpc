// ---------------------------------------------------------------------------
// orders-service/db/db.module.ts  —  NestJS module that wires the Drizzle client.
//
// Identical pattern to products-service's DrizzleModule. Both services share
// the same Postgres instance in dev (same DATABASE_URL) but conceptually own
// separate tables. In production each service would have its own database URL.
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
        const url = config.getOrThrow<string>('DATABASE_URL');
        return drizzle(postgres(url), { schema });
      },
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DrizzleModule {}
