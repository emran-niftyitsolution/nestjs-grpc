// ---------------------------------------------------------------------------
// auth-service / db/schema.ts  —  Drizzle ORM schema for the users table.
//
// WHY A DEDICATED users TABLE (not reusing products-service DB):
//   Each microservice owns its data. The users table belongs to auth-service
//   exclusively — no other service queries it directly. In production each
//   service would have a fully separate database; here they share one Postgres
//   instance (SAME DATABASE_URL) but have separate tables and migration histories.
//
//   This is the core "database per service" pattern in microservices, relaxed
//   slightly for a dev environment (shared Postgres container, separate tables).
// ---------------------------------------------------------------------------

import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // WHY uuid over serial:  same reasoning as products — no sequential guessing,
  // can be generated client-side, fits the microservice pattern.
  id: uuid('id').defaultRandom().primaryKey(),

  // Email is the login credential. UNIQUE ensures one account per address.
  // The DB constraint enforces this even if two concurrent requests race.
  email: varchar('email', { length: 255 }).notNull().unique(),

  // Display name shown in the UI and embedded in the JWT payload.
  name: varchar('name', { length: 255 }).notNull(),

  // WHY varchar(255) for a hash:
  //   bcrypt output is always 60 characters. 255 gives headroom if we ever
  //   migrate to argon2 (97 chars) or another algorithm without a schema change.
  //
  // NEVER returned over gRPC — auth.proto's AuthUser message deliberately
  // omits this field so it can't accidentally leak to clients.
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// TypeScript types inferred directly from the table definition.
// `User`    — shape of a row returned by SELECT (includes all columns).
// `NewUser` — shape passed to INSERT (id/timestamps are optional, they have defaults).
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
