// ---------------------------------------------------------------------------
// orders-service/db/index.ts  —  single import surface for the DB layer.
// Identical pattern to products-service/db/index.ts.
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';
export type DrizzleClient = PostgresJsDatabase<typeof schema>;

export * from './schema';
