// ---------------------------------------------------------------------------
// products.interfaces.ts  —  TypeScript types that mirror products.proto.
//
// WHY WE WRITE THESE MANUALLY:
//   `@grpc/proto-loader` loads the .proto at runtime and produces plain JS
//   objects. NestJS doesn't auto-generate .ts interfaces from .proto (tools
//   like `ts-proto` or `protoc-gen-ts` can do that, but add build complexity).
//   For this learning project we write the interfaces by hand — they are
//   simple enough, and writing them forces you to understand the mapping.
//
// FIELD NAME CASING — snake_case in proto → camelCase in TypeScript:
//   `@grpc/proto-loader` converts proto field names to camelCase by default
//   (the `keepCase: false` option). So:
//     proto field   `created_at`  →  TypeScript property  `createdAt`
//     proto field   `updated_at`  →  TypeScript property  `updatedAt`
//   These interfaces use camelCase to match what the runtime actually delivers.
// ---------------------------------------------------------------------------

// Mirrors the `Product` message in products.proto.
export interface Product {
  id: string;
  name: string;
  description: string;
  price: string; // decimal as string — see proto comment for why
  stock: number;
  createdAt: string; // camelCase (was created_at in proto)
  updatedAt: string; // camelCase (was updated_at in proto)
}

// --- FindAll ---
// Empty interface intentional — FindAllRequest has no fields yet (no filters).
// Biome's noEmptyBlockStatements is off for NestJS patterns; this is fine.
export interface FindAllRequest {} // empty message — no filter fields yet
export interface FindAllResponse {
  products: Product[];
}

// --- ListStream (Step 9) ---
// Empty request, kept separate from FindAllRequest so each can grow independently.
export interface ListStreamRequest {}

// --- FindOne ---
export interface FindOneRequest {
  id: string;
}

// --- CreateProduct ---
export interface CreateProductRequest {
  name: string;
  description: string;
  price: string;
  stock: number;
}

// --- UpdateProduct ---
export interface UpdateProductRequest {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
}

// --- DeleteProduct ---
export interface DeleteProductRequest {
  id: string;
}
export interface DeleteProductResponse {
  success: boolean;
}
