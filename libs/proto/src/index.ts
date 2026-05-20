// ---------------------------------------------------------------------------
// libs/proto/src/index.ts  —  the single import surface for the shared contract.
//
// WHAT THIS FILE EXPORTS:
//   1. Constants:  the package name + proto file path that BOTH apps need
//   2. Interfaces: TypeScript types for every proto message
//
// HOW IT IS USED:
//   products-service (Step 4, server):
//     import { PRODUCTS_PACKAGE, PRODUCTS_PROTO_PATH } from '@app/proto';
//     NestFactory.createMicroservice(..., { options: { package, protoPath } })
//
//   api-gateway (Step 5, client):
//     import { PRODUCTS_PACKAGE, PRODUCTS_PROTO_PATH, Product } from '@app/proto';
//     ClientsModule.register([{ transport: Transport.GRPC, options: { ... } }])
//
// WHY @app/proto (not a relative path):
//   The `@app/proto` alias is declared in the root tsconfig.json `paths`
//   section and resolves to this directory. This avoids import paths like
//   `../../../../libs/proto/src` across both apps.
// ---------------------------------------------------------------------------

import { join } from 'path';

// ---------------------------------------------------------------------------
// gRPC CONSTANTS
// ---------------------------------------------------------------------------

// Must match `package products;` at the top of products.proto EXACTLY.
// The gRPC runtime uses this to route calls to the right service.
export const PRODUCTS_PACKAGE = 'products';

// NestJS injection token used in two places:
//   1. ClientsModule.register([{ name: PRODUCTS_SERVICE, ... }])  ← registers the client
//   2. @Inject(PRODUCTS_SERVICE) in the gateway service            ← injects the client
// Using a string constant (not a class) because the gRPC client factory
// is not a class — it's a dynamic proxy created by @nestjs/microservices.
export const PRODUCTS_SERVICE = 'PRODUCTS_SERVICE';

// Absolute path to the proto file resolved from this source file's location.
//
// WHY import.meta.dirname (not __dirname):
//   This project uses `"module": "nodenext"` in tsconfig, which outputs ES
//   modules. In ESM, `__dirname` is not defined by the spec — you use
//   `import.meta.dirname` instead (available in Node 21+ and Bun 1+).
//   Bun 1.3+ supports it, and TypeScript 5.3+ types it for nodenext.
//   Result: join('/path/to/libs/proto/src', 'products.proto')
//         = '/path/to/libs/proto/src/products.proto'
export const PRODUCTS_PROTO_PATH = join(import.meta.dirname, 'products.proto');

// ---------------------------------------------------------------------------
// ORDERS constants — same pattern as products above.
// ---------------------------------------------------------------------------

export const ORDERS_PACKAGE = 'orders';
export const ORDERS_SERVICE = 'ORDERS_SERVICE'; // DI injection token

// Proto path for orders.proto — used by BOTH:
//   orders-service main.ts  (gRPC server bootstrap)
//   api-gateway orders.module.ts (gRPC client registration)
//   orders-service orders.module.ts (gRPC client for products — yes, it's a client too)
export const ORDERS_PROTO_PATH = join(import.meta.dirname, 'orders.proto');

// ---------------------------------------------------------------------------
// AUTH constants — same pattern as products / orders above.
// ---------------------------------------------------------------------------

// Must match `package auth;` at the top of auth.proto EXACTLY.
export const AUTH_PACKAGE = 'auth';

// Injection token for the auth-service gRPC client in the gateway.
// Used in:
//   apps/api-gateway/src/auth/auth.module.ts  (ClientsModule.register name)
//   apps/api-gateway/src/auth/auth.service.ts (@Inject(AUTH_SERVICE))
export const AUTH_SERVICE = 'AUTH_SERVICE';

// Absolute path to auth.proto — used by BOTH:
//   auth-service main.ts            (gRPC server bootstrap)
//   api-gateway auth.module.ts      (gRPC client registration)
export const AUTH_PROTO_PATH = join(import.meta.dirname, 'auth.proto');

// ---------------------------------------------------------------------------
// TypeScript interfaces that mirror the proto messages.
// Both apps import from here to type their gRPC calls and handlers.
// ---------------------------------------------------------------------------
export * from './auth.interfaces';
export * from './orders.interfaces';
export * from './products.interfaces';
