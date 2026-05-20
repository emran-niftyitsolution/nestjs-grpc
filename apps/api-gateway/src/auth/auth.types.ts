// ---------------------------------------------------------------------------
// api-gateway / auth.types.ts  —  GraphQL type definitions for the Auth domain.
//
// SAME PATTERN as products.types.ts and orders.types.ts.
//
// TYPE HIERARCHY (mirroring the proto messages):
//   AuthUserType      → public user profile (id, email, name, createdAt)
//   AuthPayloadType   → what Register + Login return (accessToken + user)
//   TokenPayloadType  → what the `me` query returns (decoded JWT content)
//
//   RegisterInput  → input for the `register` mutation
//   LoginInput     → input for the `login` mutation
//
// WHY password is NOT on any output type:
//   The passwordHash must never leave auth-service. The proto AuthUser message
//   deliberately omits it. These GraphQL types mirror that omission.
// ---------------------------------------------------------------------------

import { Field, InputType, ObjectType } from '@nestjs/graphql';

// ===========================================================================
// OUTPUT TYPES — returned by queries and mutations
// ===========================================================================

// The public profile of a registered user.
// Returned as part of AuthPayloadType after register / login.
@ObjectType()
export class AuthUserType {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  name: string;

  // ISO-8601 timestamp string (proto3 has no native Date type).
  @Field()
  createdAt: string;
}

// Returned by both `register` and `login` mutations.
// accessToken is the JWT the client must send in subsequent requests as:
//   Authorization: Bearer <accessToken>
@ObjectType()
export class AuthPayloadType {
  @Field()
  accessToken: string;

  // The newly registered / authenticated user's public profile.
  @Field(() => AuthUserType)
  user: AuthUserType;
}

// Returned by the `me` query — the decoded content of the current JWT.
// Includes userId so clients can make user-specific queries without a
// separate "get my profile" round-trip.
@ObjectType()
export class TokenPayloadType {
  // camelCase of proto field user_id.
  @Field()
  userId: string;

  @Field()
  email: string;

  @Field()
  name: string;
}

// ===========================================================================
// INPUT TYPES — received by mutations
// ===========================================================================

@InputType()
export class RegisterInput {
  @Field()
  email: string;

  // The plain-text password. auth-service hashes it with bcrypt before
  // storing. It is transmitted over gRPC (TLS in production), never stored.
  @Field()
  password: string;

  @Field()
  name: string;
}

@InputType()
export class LoginInput {
  @Field()
  email: string;

  @Field()
  password: string;
}
