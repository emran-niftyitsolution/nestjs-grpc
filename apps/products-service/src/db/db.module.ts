// ---------------------------------------------------------------------------
// db.module.ts  —  NestJS module that creates and provides the Drizzle client.
//
// WHAT THIS MODULE DOES:
//   It creates ONE postgres.js connection pool and ONE Drizzle client, wraps
//   them in a NestJS provider, and exports that provider so any other module
//   in products-service can inject the DB client with @Inject(DRIZZLE_CLIENT).
//
// WHY A SEPARATE MODULE (not just put everything in AppModule)?
//   Separation of concerns: AppModule declares WHAT the app has (controllers,
//   services). DrizzleModule declares HOW the DB is connected. If you ever
//   swap postgres.js for Bun's built-in SQL, you change only this file.
//   The controllers and services that use the client are unaffected.
// ---------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// `drizzle` is the factory function that creates a typed query builder.
import { drizzle } from 'drizzle-orm/postgres-js';

// `postgres` is the postgres.js connection function. It creates a connection
// pool automatically (default: 10 connections). Pure JavaScript — no native
// addon, works perfectly on Bun and standard Node.
import postgres from 'postgres';
import { DRIZZLE_CLIENT } from './index';
// Our schema: drizzle needs to know the tables to enable the relational query
// API (db.query.products.findMany) and for TypeScript to infer return types.
import * as schema from './schema';

@Module({
  providers: [
    {
      // The token other classes use to receive this value via @Inject().
      provide: DRIZZLE_CLIENT,

      // `useFactory` + `inject` is the NestJS pattern for providers that
      // need OTHER providers (here: ConfigService) to be constructed.
      // Nest resolves ConfigService first, then calls this function with it.
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Read DATABASE_URL from .env (loaded globally by ConfigModule).
        // The `!` non-null assertion: we know it exists because
        // drizzle.config.ts already guards for it at migration time, and
        // the .env setup in Step 2 ensures it's always present.
        const url = config.getOrThrow<string>('DATABASE_URL');

        // `postgres(url)` creates a connection pool. postgres.js is smart:
        // it opens connections lazily (first query), keeps them alive, and
        // closes them on process exit. The pool size defaults to 10.
        // In a gRPC service that receives many concurrent RPCs, the pool
        // absorbs bursts without overwhelming Postgres.
        const client = postgres(url);

        // `drizzle(client, { schema })` wraps the pool in Drizzle's query
        // builder. Passing `schema` unlocks:
        //   1. The relational API: db.query.products.findMany(...)
        //   2. TypeScript knowing every table and column at compile time.
        // The returned object is what controllers/services inject and use.
        return drizzle(client, { schema });
      },
    },
  ],

  // CRITICAL: without `exports`, the DRIZZLE_CLIENT provider is PRIVATE to
  // this module — other modules that import DrizzleModule could not inject it.
  // Exporting makes it available to any module that imports DrizzleModule.
  exports: [DRIZZLE_CLIENT],
})
export class DrizzleModule {}
