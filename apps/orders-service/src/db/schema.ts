// ---------------------------------------------------------------------------
// apps/orders-service/src/db/schema.ts  —  Drizzle schema for the orders table.
//
// This file is the "source of truth" for what the orders table looks like.
// Drizzle-kit reads it to generate SQL migrations.
//
// IMPORTANT DESIGN DECISION — no database FK to products:
//   In a proper microservices architecture each service owns its data.
//   orders-service stores product_id as a plain UUID (no REFERENCES products).
//   WHY: If products-service has a different DB (correct in prod), a FK
//   constraint across databases is impossible. We validate the product exists
//   at the BUSINESS LOGIC level by calling products-service via gRPC before
//   inserting the order. This is the "API as the integration boundary" pattern.
// ---------------------------------------------------------------------------

import { integer, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),

  // The product being ordered — a UUID that references a product, but
  // enforced by gRPC call (not a DB foreign key). See note above.
  productId: uuid('product_id').notNull(),

  // How many units of the product were ordered.
  quantity: integer('quantity').notNull(),

  // Pre-computed total: product.price × quantity, stored so it never changes
  // even if the product price changes later. Stored as numeric string for
  // the same reason as products.price — exact decimal arithmetic.
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),

  // Order lifecycle: pending → confirmed → shipped → delivered | cancelled.
  // Stored as a string for simplicity; in production this would be a DB enum.
  status: varchar('status', { length: 50 }).notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
