// ---------------------------------------------------------------------------
// drizzle.config.ts  —  configuration for the drizzle-kit CLI.
//
// THIS FILE IS NOT PART OF THE RUNTIME APP. It is read only by the
// drizzle-kit tool when you run `bun run db:generate` or `bun run db:migrate`.
// Think of it as the "settings file" for the migration toolchain.
//
// HOW THE TOOLS USE IT:
//   bun run db:generate  →  drizzle-kit reads your schema.ts, diffs it
//                            against previous migrations, and WRITES a new
//                            .sql file into the `out` directory.
//   bun run db:migrate   →  drizzle-kit reads every .sql file from `out`
//                            that hasn't been applied yet (tracked in a
//                            `__drizzle_migrations` table Drizzle manages
//                            inside your Postgres DB) and runs them.
//
// WHY bun auto-loads .env here:
//   When you run scripts via `bun run ...`, Bun AUTOMATICALLY reads the
//   .env file in the working directory and populates process.env BEFORE
//   executing the script. So DATABASE_URL is available here without any
//   `import 'dotenv/config'` — as long as you use `bun run`, not `node`.
// ---------------------------------------------------------------------------

import { defineConfig } from 'drizzle-kit';

// Guard: if DATABASE_URL is missing, drizzle-kit would throw a cryptic error
// deep inside. This surfaces the real problem immediately.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Make sure .env exists at the repo root ' +
      'and you are running via `bun run db:*` (Bun loads .env automatically).',
  );
}

export default defineConfig({
  // WHERE to find your schema (the TS definitions of your tables).
  // drizzle-kit imports this to understand the DESIRED state of the DB.
  // Only products-service owns a database — so only its schema is here.
  // If you add an orders-service with its own DB later, you'd add a second
  // config or expand this path to a glob.
  schema: './apps/products-service/src/db/schema.ts',

  // WHERE to write (generate) and read (migrate) .sql migration files.
  // We keep them COLOCATED with the service that owns the DB — products-service.
  // In Step 8 (Dockerize) these files land inside the products-service image.
  out: './apps/products-service/src/db/migrations',

  // Tell drizzle-kit which SQL dialect to target. 'postgresql' = it will use
  // Postgres-specific syntax (e.g. `gen_random_uuid()`, `TIMESTAMPTZ`).
  dialect: 'postgresql',

  dbCredentials: {
    // The full Postgres connection string from .env.
    // drizzle-kit uses this to CONNECT to the live DB during `migrate`
    // (and optionally `push`). It does NOT touch the DB during `generate`.
    url: process.env.DATABASE_URL,
  },

  // Print every SQL statement drizzle-kit runs. Highly recommended while
  // learning — you see exactly what SQL is applied to your DB.
  verbose: true,
});
