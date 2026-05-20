// ---------------------------------------------------------------------------
// products.service.ts  —  business logic + Drizzle ORM queries (Step 6).
//
// WHAT CHANGED FROM STEP 4 (stubs):
//   Every method now runs a real Drizzle query against PostgreSQL.
//   The stub helper `stubProduct()` is gone.
//   gRPC error mapping is added: missing rows → RpcException with a gRPC
//   status code so the caller (api-gateway) gets the right error type.
//
// TWO "Product" TYPES — WHY BOTH EXIST:
//   DbProduct  (Drizzle $inferSelect):  the shape of a PostgreSQL row.
//              description: string | null   (nullable column)
//              createdAt:   Date            (JS Date object)
//              updatedAt:   Date
//
//   ProtoProduct (from @app/proto):    the shape of a gRPC protobuf message.
//              description: string          (proto3: no null, uses "" for absence)
//              createdAt:   string          (ISO-8601 string, not a Date)
//              updatedAt:   string
//
//   The DB layer speaks SQL types; the gRPC layer speaks proto types.
//   `toProtoProduct()` below is the translation boundary between them.
// ---------------------------------------------------------------------------

import type {
  CreateProductRequest,
  DeleteProductRequest,
  DeleteProductResponse,
  FindAllResponse,
  FindOneRequest,
  ListStreamRequest,
  Product as ProtoProduct,
  UpdateProductRequest,
} from '@app/proto';
// status — the gRPC status code enum from @grpc/grpc-js.
//   Canonical codes: NOT_FOUND (5), INVALID_ARGUMENT (3), ALREADY_EXISTS (6),
//   INTERNAL (13), etc. The full list mirrors HTTP status codes loosely.
//   WHY import from @grpc/grpc-js and not @nestjs/microservices:
//   NestJS re-exports only a subset; the full enum lives in the gRPC JS lib.
import { status } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
// RpcException — NestJS wrapper for gRPC errors.
//   Throwing a plain JS Error inside a gRPC handler sends the caller a generic
//   UNKNOWN status code. Throwing RpcException lets you specify the EXACT
//   gRPC status code (NOT_FOUND, INVALID_ARGUMENT, etc.) so the gateway and
//   the client can react appropriately (e.g. return 404 vs 500).
import { RpcException } from '@nestjs/microservices';
// eq — Drizzle's equality operator for WHERE clauses.
//   db.select().from(products).where(eq(products.id, id))
//   compiles to: SELECT ... FROM products WHERE id = $1
import { eq } from 'drizzle-orm';
import { from, mergeMap, type Observable } from 'rxjs';

// Import BOTH the injection token/client type AND the schema exports.
// DrizzleClient — the typed Drizzle client (knows about our schema).
// products      — the Drizzle table object used in .select().from(products).
// DbProduct     — TypeScript type of a row returned by SELECT * FROM products.
import { type Product as DbProduct, DRIZZLE_CLIENT, type DrizzleClient, products } from '../db';

// ---------------------------------------------------------------------------
// toProtoProduct  —  converts a Drizzle DB row to the proto message shape.
//
// WHY this function exists (and why it must be explicit):
//   A Drizzle SELECT returns DbProduct with Date objects and nullable fields.
//   The gRPC proto uses strings for timestamps and empty string for "no value".
//   If we returned the DB row directly, TypeScript would error on the type
//   mismatch, and proto-loader would silently drop the mismatched fields.
//
// Called from every method that returns a Product to the gateway.
// ---------------------------------------------------------------------------
function toProtoProduct(row: DbProduct): ProtoProduct {
  return {
    id: row.id,
    name: row.name,

    // Drizzle: `string | null` (nullable column in schema).
    // Proto3:  always a string — uses "" as the "no value" sentinel.
    // `?? ''` converts null → empty string to satisfy the proto contract.
    description: row.description ?? '',

    // numeric(10,2) in Postgres → Drizzle returns it as a string already
    // (prevents floating-point precision loss). No conversion needed.
    price: row.price,

    stock: row.stock,

    // Postgres TIMESTAMP WITH TIME ZONE → Drizzle returns a JS Date object.
    // Proto3 has no native Date type — we serialize as ISO-8601 string.
    // The gateway and any client can parse this with `new Date(createdAt)`.
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// @Injectable() registers this class in Nest's DI container. Required so
// ProductsController can receive it via constructor injection.
@Injectable()
export class ProductsService {
  constructor(
    // DRIZZLE_CLIENT is the DI token string ('DRIZZLE_CLIENT').
    // `type DrizzleClient` — inline `type` modifier prevents emitting the
    // import as a value in the compiled JS, which is required when
    // `isolatedModules: true` is set in tsconfig (decorator metadata
    // requires value imports for class types but errors on type-only ones).
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  // ---------------------------------------------------------------------------
  // LIST STREAM (Step 9) — emits each product as a separate gRPC frame.
  //
  // RETURN TYPE: Observable<ProtoProduct> — not Promise.
  //   NestJS's gRPC server adapter checks the return value of a @GrpcMethod
  //   handler. When it receives an Observable it calls call.write(value) for
  //   each emission and call.end() when the Observable completes — that's
  //   exactly what server-streaming requires.
  //
  // HOW THE RxJS PIPELINE WORKS:
  //   from(promise)            — wraps the DB query Promise in an Observable.
  //                              Emits ONE value: the rows array.
  //   mergeMap(rows => ...)    — "flattens" the array by turning it into a
  //                              child Observable that emits one row at a time.
  //   from(rows.map(...))      — turns the Product[] array into an Observable
  //                              that emits each product individually, then completes.
  //
  //   Net effect: the outer Observable emits N individual ProtoProduct values
  //   (one per DB row) before completing. The gRPC adapter writes each as a
  //   separate response frame on the wire.
  // ---------------------------------------------------------------------------
  listStream(_data: ListStreamRequest): Observable<ProtoProduct> {
    return from(this.db.select().from(products)).pipe(
      mergeMap(rows => from(rows.map(toProtoProduct))),
    );
  }

  // ---------------------------------------------------------------------------
  // FIND ALL — SELECT * FROM products
  // ---------------------------------------------------------------------------
  async findAll(): Promise<FindAllResponse> {
    // db.select() — starts a SELECT query builder.
    // .from(products) — specifies the table. Drizzle infers the column types
    //   from the `products` table definition in schema.ts automatically.
    // No .where() = no filter = all rows.
    const rows = await this.db.select().from(products);

    // Map every DB row to the proto shape before returning.
    // findAll returns { products: [...] } not just [...] because the proto
    // wraps repeated fields in a message (FindAllResponse).
    return { products: rows.map(toProtoProduct) };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE — SELECT * FROM products WHERE id = $1
  // ---------------------------------------------------------------------------
  async findOne(data: FindOneRequest): Promise<ProtoProduct> {
    // Drizzle returns an array even for single-row queries.
    // Destructuring assignment `const [row]` puts the first element (or
    // undefined if no rows matched) into `row`.
    const [row] = await this.db.select().from(products).where(eq(products.id, data.id));

    // If no row matched the id, throw a gRPC NOT_FOUND error.
    //
    // WHY RpcException and not a plain Error / HttpException:
    //   This is a gRPC microservice — there's no HTTP response to send.
    //   Throwing a plain Error makes NestJS send gRPC status UNKNOWN (13).
    //   RpcException({ code, message }) sends the correct code (NOT_FOUND = 5)
    //   so the gateway can map it to a proper GraphQL / HTTP error downstream.
    if (!row) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product with id '${data.id}' not found`,
      });
    }

    return toProtoProduct(row);
  }

  // ---------------------------------------------------------------------------
  // CREATE — INSERT INTO products ... RETURNING *
  // ---------------------------------------------------------------------------
  async create(data: CreateProductRequest): Promise<ProtoProduct> {
    // db.insert(products) — inserts into the `products` table.
    // .values({...}) — the column values. We omit `id`, `createdAt`, and
    //   `updatedAt` because they have database-level defaults (gen_random_uuid(),
    //   NOW()). Drizzle knows not to include them based on the schema definition.
    // .returning() — appends RETURNING * to the SQL so Postgres returns the
    //   newly inserted row including all generated defaults (id, timestamps).
    //   Without this, you'd need a second SELECT to get the created row.
    const [row] = await this.db
      .insert(products)
      .values({
        name: data.name,
        // Empty string from proto → null in the DB (matches nullable column).
        description: data.description || null,
        price: data.price,
        stock: data.stock,
      })
      .returning();

    // INSERT ... RETURNING always returns the row when it succeeds.
    // If the insert fails (constraint violation etc.) Postgres throws and
    // Drizzle propagates the error before reaching this line, so `row` is
    // guaranteed to be defined here. TypeScript agrees — no assertion needed.
    return toProtoProduct(row);
  }

  // ---------------------------------------------------------------------------
  // UPDATE — UPDATE products SET ... WHERE id = $1 RETURNING *
  // ---------------------------------------------------------------------------
  async update(data: UpdateProductRequest): Promise<ProtoProduct> {
    // Build the update set object with only the fields that were actually
    // provided. In proto3 every string field defaults to "" and every int32
    // defaults to 0 when not set by the caller, so we treat those as "skip".
    //
    // WHY partial updates (not just SET all fields unconditionally):
    //   If the gateway only sends `{ id, price: "19.99" }` to change the
    //   price, we must not overwrite `name` with "" or `stock` with 0.
    //   Checking for non-empty / meaningful values lets partial updates work.
    const updateData: {
      name?: string;
      description?: string | null;
      price?: string;
      stock?: number;
    } = {};

    // Only include name if a non-empty value was sent.
    if (data.name) updateData.name = data.name;

    // description: '' means "clear the description" (set to null).
    // Treat any provided description value as intentional.
    // We distinguish "not sent" (data.description === '' AND no other hint)
    // from "intentionally cleared". For simplicity, '' → null (clear it).
    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }

    if (data.price) updateData.price = data.price;

    // stock === 0 is a valid business state (out of stock), so always include it.
    if (data.stock !== undefined) updateData.stock = data.stock;

    // db.update(table).set(values).where(condition).returning()
    //   Compiles to: UPDATE products SET name=$1, ... WHERE id=$n RETURNING *
    const [row] = await this.db
      .update(products)
      .set(updateData)
      .where(eq(products.id, data.id))
      .returning();

    // If no row was returned, the WHERE id=... matched nothing → product missing.
    if (!row) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product with id '${data.id}' not found`,
      });
    }

    return toProtoProduct(row);
  }

  // ---------------------------------------------------------------------------
  // DELETE — DELETE FROM products WHERE id = $1 RETURNING id
  // ---------------------------------------------------------------------------
  async delete(data: DeleteProductRequest): Promise<DeleteProductResponse> {
    // .returning({ id: products.id }) — we only need to know IF a row was
    // deleted, not the full row content. Selecting just `id` is lighter than
    // returning all columns. The result is still an array (may be empty).
    const [deleted] = await this.db
      .delete(products)
      .where(eq(products.id, data.id))
      .returning({ id: products.id });

    // If the array is empty, no row matched — the product didn't exist.
    if (!deleted) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product with id '${data.id}' not found`,
      });
    }

    return { success: true };
  }
}
