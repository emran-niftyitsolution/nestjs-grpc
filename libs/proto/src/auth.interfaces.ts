// ---------------------------------------------------------------------------
// auth.interfaces.ts  —  TypeScript types that mirror auth.proto messages.
//
// SAME PATTERN as products.interfaces.ts and orders.interfaces.ts.
//
// IMPORTANT — FIELD NAME CASING:
//   @grpc/proto-loader converts proto snake_case → TypeScript camelCase by
//   default (keepCase: false). So:
//     proto field  access_token  →  TypeScript  accessToken
//     proto field  user_id       →  TypeScript  userId
//     proto field  created_at    →  TypeScript  createdAt
//   These interfaces use camelCase to match what the runtime actually delivers.
// ---------------------------------------------------------------------------

// --- Register ---
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// --- Login ---
export interface LoginRequest {
  email: string;
  password: string;
}

// --- AuthResponse (returned by both Register and Login) ---
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string; // camelCase conversion of created_at
}

export interface AuthResponse {
  accessToken: string; // camelCase conversion of access_token
  user: AuthUser;
}

// --- ValidateToken ---
export interface ValidateTokenRequest {
  token: string;
}

// TokenPayload — the decoded JWT body.
// userId is the camelCase form of user_id in the proto.
export interface TokenPayload {
  userId: string; // camelCase of user_id
  email: string;
  name: string;
}
