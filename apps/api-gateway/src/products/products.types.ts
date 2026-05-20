// ---------------------------------------------------------------------------
// products.types.ts  —  GraphQL type definitions for the Products domain.
//
// NestJS GraphQL supports two approaches:
//
//   1. CODE-FIRST (this file): Write TypeScript classes with decorators.
//      NestJS auto-generates the schema.gql file from them at startup.
//
//   2. SCHEMA-FIRST: Write a .graphql file manually, then generate TS types
//      from it with a codegen tool.
//
// WHY CODE-FIRST for a learner project:
//   You stay in TypeScript the whole time — no context-switching to .graphql
//   syntax. The decorators are self-documenting and the schema is derived, not
//   maintained separately. For small projects it is also lower overhead.
//
// HOW GRAPHQL TYPES MAP TO REST/gRPC:
//   @ObjectType  →  what GraphQL RETURNS   (like a response body / proto message)
//   @InputType   →  what GraphQL RECEIVES  (like a request body / proto request message)
//   @Field       →  exposes one property on that type in the GraphQL schema
//
// IMPORTANT: GraphQL type classes ARE NOT the same as TypeScript interfaces.
//   They are runtime objects (decorated classes), not just compile-time contracts.
//   That's why we need both @ObjectType + @Field — the decorator metadata is
//   what NestJS reads at startup to build the schema.
// ---------------------------------------------------------------------------

// Field: decorator to mark a class property as a GraphQL field.
// Int:   GraphQL's 32-bit integer scalar (number in TS). Must import explicitly
//        because JS has ONE number type; GraphQL distinguishes Int vs Float.
// ObjectType: marks this class as a GraphQL output type (used in responses).
// InputType:  marks this class as a GraphQL input type (used in mutations).
import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

// ---------------------------------------------------------------------------
// OUTPUT TYPES — returned by queries and mutations
// ---------------------------------------------------------------------------

// @ObjectType() tells NestJS GraphQL to include this class in the schema
// as a named type. The class name becomes the type name in the SDL:
//   type ProductType { id: String! name: String! ... }
@ObjectType()
export class ProductType {
  // @Field() exposes this property as a field in the GraphQL schema.
  // No argument needed for String — NestJS infers scalar type from TypeScript.
  @Field()
  id: string;

  @Field()
  name: string;

  // nullable: true → the field can be null or absent in the response.
  // Matches the proto definition where description is an optional string.
  // In GraphQL SDL this generates:  description: String   (no ! = nullable)
  @Field({ nullable: true })
  description?: string;

  // WHY price is String (not Float):
  //   Monetary values should NEVER use floating-point — 0.1 + 0.2 ≠ 0.3 in
  //   binary floats. Our Drizzle schema uses numeric(10,2) in Postgres, the
  //   proto uses string to avoid float loss, and we carry that string here.
  //   The client displays "9.99", not 9.990000000000001.
  @Field()
  price: string;

  // @Field(() => Int) — for number fields you must tell GraphQL whether you
  // want Int (32-bit integer) or Float (64-bit float). Without the lambda
  // NestJS would infer Float from TypeScript's `number`. Stock is always a
  // whole number, so Int is correct here.
  @Field(() => Int)
  stock: number;

  // Timestamps arrive as ISO-8601 strings from gRPC (proto stores them as
  // strings). GraphQL has no built-in DateTime scalar so we keep them as String.
  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

// @ObjectType for the delete mutation response.
// Returns a simple boolean — did the deletion succeed?
// WHY not just Boolean: wrapping in an object makes the response extensible
// later (add `deletedId`, `message`, etc.) without breaking existing queries.
@ObjectType()
export class DeleteResult {
  @Field()
  success: boolean;
}

// ---------------------------------------------------------------------------
// INPUT TYPES — received by mutations
// ---------------------------------------------------------------------------

// @InputType() is like @ObjectType() but for mutation arguments.
// GraphQL distinguishes input and output types — you cannot use the same class
// for both. InputType classes cannot have resolver methods, only plain fields.
@InputType()
export class CreateProductInput {
  @Field()
  name: string;

  // nullable: true — description is optional when creating a product.
  @Field({ nullable: true })
  description?: string;

  // price as String — matches the proto and Drizzle numeric(10,2) column.
  @Field()
  price: string;

  // defaultValue: 0 — if the mutation omits `stock`, GraphQL uses 0.
  // This mirrors the database column default (DEFAULT 0 in the migration).
  @Field(() => Int, { defaultValue: 0 })
  stock: number;
}

// UpdateProductInput includes the id (to find the product) plus ALL updatable
// fields. Every field except `id` is nullable — the client only sends what
// it wants to change.
@InputType()
export class UpdateProductInput {
  // id is required — we must know WHICH product to update.
  @Field()
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  price?: string;

  @Field(() => Int, { nullable: true })
  stock?: number;
}
