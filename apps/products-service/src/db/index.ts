// ---------------------------------------------------------------------------
// db/index.ts  —  shared exports for the database layer.
//
// WHY a separate index file (not just importing directly from schema.ts or
// db.module.ts)?
//   Single import surface. Any file that needs DB things writes:
//     import { DRIZZLE_CLIENT, DrizzleClient, products } from './db';
//   instead of reaching into different sub-files. If we restructure later
//   (e.g. split into multiple schema files), only this index changes.
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// INJECTION TOKEN — the key Nest uses to look up the Drizzle client in its
// DI container. We use a plain string for clarity. In a larger app you might
// use a Symbol to avoid accidental collisions, but a string is fine here.
// Controllers/services inject it with:  @Inject(DRIZZLE_CLIENT)
export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';

// The TypeScript type for the injected Drizzle client.
// PostgresJsDatabase<typeof schema> means:
//   "a Drizzle client backed by postgres.js that knows about OUR schema".
// Having the schema generic unlocks relational queries (Step 7) and means
// TypeScript knows every table name, column name, and column type.
export type DrizzleClient = PostgresJsDatabase<typeof schema>;

// Re-export everything from schema so callers only need one import:
//   import { products, Product, NewProduct, DRIZZLE_CLIENT, DrizzleClient } from './db';
export * from './schema';
