// ---------------------------------------------------------------------------
// auth-service / db/index.ts  —  single import surface for the database layer.
//
// Same pattern as products-service/db/index.ts and orders-service/db/index.ts.
// Re-exports the DI token, client type, and all schema symbols so consumers
// write one import line instead of reaching into sub-files.
//
//   import { DRIZZLE_CLIENT, DrizzleClient, users, User } from '../db';
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Injection token — the string key Nest uses to look up the Drizzle client.
// Must match `provide: DRIZZLE_CLIENT` in DrizzleModule and
// `@Inject(DRIZZLE_CLIENT)` in AuthService.
export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';

// The TypeScript type for the injected client.
// The schema generic means `db.select().from(users)` returns typed User[] —
// no manual type annotations needed on query results.
export type DrizzleClient = PostgresJsDatabase<typeof schema>;

// Re-export table definitions and row types for one-line imports in services.
export * from './schema';
