// ---------------------------------------------------------------------------
// drizzle.orders.config.ts  —  drizzle-kit config for the orders-service DB.
//
// WHY a SEPARATE config file (not adding orders to drizzle.config.ts):
//   Each service owns its schema and migration history independently.
//   Mixing schemas in one config creates one shared migration sequence —
//   that's coupling. With separate configs:
//     bun run db:generate:products  →  generates only products migrations
//     bun run db:generate:orders    →  generates only orders migrations
//   The two migration histories are decoupled. In production each service
//   would run its own migrations at startup, not a shared migration runner.
//
// In this dev setup BOTH services share one Postgres instance for simplicity.
// The tables live in the same `public` schema. In production you'd use
// separate databases (or at minimum separate Postgres schemas per service).
// ---------------------------------------------------------------------------

import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Run via `bun run db:*:orders`.');
}

export default defineConfig({
  schema: './apps/orders-service/src/db/schema.ts',
  out: './apps/orders-service/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  verbose: true,
});
