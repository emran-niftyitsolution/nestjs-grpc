// ---------------------------------------------------------------------------
// drizzle.auth.config.ts  —  drizzle-kit config for the auth-service DB.
//
// WHY a separate config (not combined with drizzle.config.ts):
//   Same reason as drizzle.orders.config.ts — each service owns its schema
//   and migration history independently. With three separate configs:
//     bun run db:generate:products  →  only products migrations
//     bun run db:generate:orders    →  only orders migrations
//     bun run db:generate:auth      →  only auth (users table) migrations
//
//   The auth service uses the SAME DATABASE_URL as the other services in dev
//   (shared Postgres container, separate tables). In production it would have
//   a dedicated DB with its own connection string (AUTH_DATABASE_URL).
// ---------------------------------------------------------------------------

import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Run via `bun run db:*:auth`.');
}

export default defineConfig({
  // auth-service owns only the `users` table.
  schema: './apps/auth-service/src/db/schema.ts',

  // Migration files are colocated with the service that owns them.
  // In the auth-service Docker image, these land at the expected path for
  // `bunx drizzle-kit migrate --config drizzle.auth.config.ts`.
  out: './apps/auth-service/src/db/migrations',

  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  verbose: true,
});
