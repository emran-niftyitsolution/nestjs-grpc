// ---------------------------------------------------------------------------
// auth-service / auth.service.ts  —  business logic for all auth RPCs.
//
// RESPONSIBILITIES:
//   register     — validate uniqueness, hash password, insert user, sign JWT
//   login        — look up user by email, verify password hash, sign JWT
//   validateToken — verify JWT signature + expiry, return decoded payload
//
// PASSWORD HASHING — WHY bcryptjs:
//   Passwords must NEVER be stored plain or with a fast hash (MD5, SHA-256).
//   bcrypt is designed to be slow (work factor / cost parameter) to make
//   brute-force and dictionary attacks expensive. `bcryptjs` is a pure-JS
//   implementation — no native addon, works identically on Bun and Node.
//
//   Cost factor 12 (BCRYPT_ROUNDS) means ~2^12 = 4096 iterations. On modern
//   hardware this takes ~250ms, which is imperceptible to a human but makes
//   mass-cracking 10x slower than cost=10 (the default).
//
// JWT SIGNING — WHY auth-service holds the secret:
//   The JWT secret never leaves this service. The gateway calls ValidateToken
//   via gRPC rather than verifying locally, so the secret doesn't need to be
//   distributed. This is the "token introspection" pattern: only the issuer
//   can verify tokens.
//
// ERROR CODES — gRPC status codes, NOT HTTP:
//   This is a gRPC microservice — there is no HTTP response to send.
//   RpcException({ code, message }) sets the gRPC wire status so the gateway
//   gets a structured error it can map to GraphQL errors downstream.
//   Full code list: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
// ---------------------------------------------------------------------------

import type {
  AuthResponse,
  LoginRequest,
  AuthUser as ProtoAuthUser,
  RegisterRequest,
  TokenPayload,
  ValidateTokenRequest,
} from '@app/proto';
import { status } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { type User as DbUser, DRIZZLE_CLIENT, type DrizzleClient, users } from '../db';

// ---------------------------------------------------------------------------
// toProtoAuthUser — converts a Drizzle DB row to the proto message shape.
//
// SAME PATTERN as toProtoProduct / toProtoOrder in other services.
// DB types differ from proto types in:
//   createdAt:     Date (JS)       → string (ISO-8601)
//   passwordHash:  string (DB)     → OMITTED (never sent over the wire)
// ---------------------------------------------------------------------------
function toProtoAuthUser(row: DbUser): ProtoAuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    // Date → ISO-8601 string. Clients can parse with `new Date(createdAt)`.
    createdAt: row.createdAt.toISOString(),
    // passwordHash is intentionally NOT included — it must never leave this service.
  };
}

// Work factor for bcrypt. 12 = ~250ms per hash on modern hardware.
// Too low (< 10) = easy to brute-force. Too high (> 14) = login feels slow.
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,

    // JwtService is provided by JwtModule.register() in auth.module.ts.
    // It wraps jsonwebtoken with the configured secret + sign options.
    private readonly jwtService: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // REGISTER — create a new user account.
  // ---------------------------------------------------------------------------
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // ── 1. Uniqueness check ──────────────────────────────────────────────────
    // Check BEFORE hashing to avoid a slow bcrypt call when the email exists.
    // The DB has a UNIQUE constraint on email as the ultimate guard, but checking
    // here gives us a descriptive error rather than a raw constraint violation.
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email));

    if (existing) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: `An account with email '${data.email}' already exists`,
      });
    }

    // ── 2. Hash the password ────────────────────────────────────────────────
    // bcrypt.hash(password, rounds) is async because hashing is CPU-intensive.
    // `BCRYPT_ROUNDS` controls the work factor — see file header for rationale.
    // The stored hash includes the salt, algorithm, and cost factor so we only
    // need to store one column to verify later.
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // ── 3. Insert the new user ───────────────────────────────────────────────
    // .returning() — Postgres returns the full row including generated `id`
    // and `createdAt`. We need these to build the JWT payload and response.
    const [user] = await this.db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        passwordHash,
      })
      .returning();

    // ── 4. Sign the JWT ──────────────────────────────────────────────────────
    return { accessToken: this.signToken(user), user: toProtoAuthUser(user) };
  }

  // ---------------------------------------------------------------------------
  // LOGIN — authenticate an existing user.
  // ---------------------------------------------------------------------------
  async login(data: LoginRequest): Promise<AuthResponse> {
    // ── 1. Find user by email ────────────────────────────────────────────────
    const [user] = await this.db.select().from(users).where(eq(users.email, data.email));

    // WHY the same error message for "not found" and "wrong password":
    //   Distinguishing the two would let an attacker enumerate valid emails
    //   ("User not found" → email doesn't exist → try another).
    //   A generic "Invalid credentials" message prevents enumeration.
    if (!user) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid email or password',
      });
    }

    // ── 2. Verify password ───────────────────────────────────────────────────
    // bcrypt.compare(plaintext, hash) is constant-time on equal-length strings
    // to prevent timing attacks. It re-derives the hash using the salt embedded
    // in the stored hash string and compares byte-by-byte.
    const valid = await bcrypt.compare(data.password, user.passwordHash);

    if (!valid) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid email or password',
      });
    }

    // ── 3. Sign the JWT ──────────────────────────────────────────────────────
    return { accessToken: this.signToken(user), user: toProtoAuthUser(user) };
  }

  // ---------------------------------------------------------------------------
  // VALIDATE TOKEN — verify a JWT and return its decoded payload.
  //
  // Called by the gateway's JwtAuthGuard on every protected GraphQL operation.
  // The guard passes the raw Bearer token; we verify the signature and expiry
  // then return the embedded userId/email/name to be attached to req.user.
  // ---------------------------------------------------------------------------
  validateToken(data: ValidateTokenRequest): TokenPayload {
    try {
      // JwtService.verify() throws if the token is expired or signature-invalid.
      // On success it returns the decoded payload object.
      const payload = this.jwtService.verify<{ userId: string; email: string; name: string }>(
        data.token,
      );

      return {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
      };
    } catch {
      // Map any jwt verification error (expired, malformed, wrong signature)
      // to gRPC UNAUTHENTIC.  ATED so the gateway returns 401 to the client.
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid or expired token',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // signToken — private helper to keep JWT signing in one place.
  //
  // The JWT payload contains only what the gateway needs to serve requests:
  //   userId — to look up the user if needed
  //   email  — display in UI, filter queries
  //   name   — display in UI
  //
  // WHY NOT include passwordHash or other sensitive fields:
  //   JWTs are base64-encoded, NOT encrypted. Anyone with the token can
  //   decode the payload (just can't forge a new one without the secret).
  //   Only put data in the payload that you'd be comfortable returning in an
  //   API response — never credentials or PII beyond what's strictly needed.
  // ---------------------------------------------------------------------------
  private signToken(user: DbUser): string {
    return this.jwtService.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  }
}
