// ---------------------------------------------------------------------------
// schema.ts  —  the Drizzle ORM schema for the products-service database.
//
// WHAT THIS FILE IS:
//   A TypeScript description of what your database tables look like. Drizzle
//   uses it for two purposes:
//     1. `drizzle-kit generate` reads it to produce SQL migration files.
//     2. `drizzle()` (in db.module.ts) uses it to give you a TYPED query
//        builder — TypeScript knows column names and their types so you get
//        autocomplete and compile-time errors for wrong queries.
//
// WHY DRIZZLE OVER TYPEORM / PRISMA?
//   Drizzle keeps the schema in TypeScript (not a .prisma file, not decorators
//   on entity classes). The schema IS the source of truth — no separate file
//   format, no ORM magic mapping. It's very close to writing SQL yourself but
//   with full type safety.
// ---------------------------------------------------------------------------

import { integer, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// `pgTable` declares a Postgres table. The first arg is the ACTUAL table name
// in the DB (snake_case by convention). The second is a column map where each
// key becomes a TypeScript property on query results.
export const products = pgTable('products', {
  // --- Primary key ---
  // WHY uuid over serial/bigserial:
  //   uuid can be generated on the CLIENT (the service) without a DB round-trip.
  //   That matters in gRPC microservices where a service may need to know the
  //   ID before writing it. Also: no sequential ID guessing (security benefit).
  //   Trade-off: larger (16 bytes vs 4/8), slightly slower indexed scans.
  //   `defaultRandom()` maps to Postgres's built-in `gen_random_uuid()` —
  //   available since PG 13, no extension required. PG 18 also added
  //   `uuidv7()` but v4 random is still the standard choice.
  id: uuid('id').defaultRandom().primaryKey(),

  // --- Product fields ---
  // varchar with a length limit = the DB enforces it (no 10 MB product names).
  // `.notNull()` = the column has a NOT NULL constraint at the DB level —
  // Drizzle also makes the TypeScript type non-nullable automatically.
  name: varchar('name', { length: 255 }).notNull(),

  // text = unbounded string. Nullable by default (a product may have no
  // description). Drizzle infers `string | null` for this column.
  description: text('description'),

  // WHY numeric(10,2) and NOT float/double:
  //   Float/double use BINARY representation → cannot represent 0.10 exactly
  //   → adding prices gives results like 0.1 + 0.2 = 0.30000000000000004.
  //   numeric (a.k.a. decimal) is EXACT: stores "10.99" as "10.99". Always use
  //   numeric/decimal for money. 10 total digits, 2 decimal places.
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),

  // Integer stock count. Default 0 = a new product starts with no stock
  // (the business adds stock separately). The default is set AT THE DB LEVEL
  // so even direct SQL inserts without a stock value are safe.
  stock: integer('stock').notNull().default(0),

  // --- Timestamps ---
  // `withTimezone: true` = TIMESTAMPTZ in Postgres. ALWAYS use TIMESTAMPTZ:
  //   it stores an absolute point in time (UTC internally) and Postgres
  //   converts it to the session timezone when you read it. A plain TIMESTAMP
  //   has no timezone, which causes subtle bugs when servers are in different
  //   time zones or when daylight saving shifts happen.
  // `.defaultNow()` = `DEFAULT NOW()` at the DB level.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // `$onUpdateFn` tells Drizzle: "whenever I call .update() via the ORM,
  // automatically set this column to this value". It does NOT create a
  // database trigger — it works by injecting the value into the UPDATE
  // query that Drizzle generates. Direct SQL updates bypass this; that's
  // an acceptable trade-off since we always go through Drizzle.
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// Export the inferred TypeScript types for the table rows.
// `$inferSelect` = the shape of a row returned by SELECT queries.
// `$inferInsert` = the shape of data you pass to INSERT (omitting columns
//                  that have defaults, like id/createdAt/updatedAt).
// Consumers import these to type their service functions without re-declaring
// the shape manually.
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
