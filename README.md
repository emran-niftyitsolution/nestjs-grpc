# nestjs-grpc — a step-by-step gRPC learning project

A guided, heavily-commented project that teaches **gRPC** by building a simple
e-commerce backend with authentication. Every file is commented to explain *why*
the code is the way it is — this repo is teaching material, read the comments.

> ⚠️ This is **not** the generic NestJS starter README. The commands below
> are the real ones for this project — we use **Bun**, a **monorepo**, **gRPC**,
> **GraphQL**, and **docker-compose** — not `npm run start`.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime / package manager | **Bun 1.3** | Runs `.ts` directly, no build step in dev |
| Framework | **NestJS 11** (monorepo) | First-class gRPC + DI + module system |
| Transport | **gRPC** (`@grpc/grpc-js`) | The thing we're here to learn |
| Public API | **GraphQL** (Apollo Server v4) | Code-first schema via `@nestjs/graphql` |
| Auth | **JWT** (`@nestjs/jwt`) + **bcryptjs** | Stateless tokens, secure password storage |
| Database | **PostgreSQL 18** (Docker) | Real DB, one command to run |
| ORM / migrations | **Drizzle** | Typed schema + SQL migrations, no magic |
| Infra | **docker-compose** | Reproducible full stack (all services + DB) |

---

## Architecture

```
                  GraphQL / HTTP :5001
  Browser / curl ──────────────────────► api-gateway
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                         gRPC :50051     gRPC :50052     gRPC :50053
                              │               │               │
                              ▼               ▼               ▼
                        auth-service   products-service  orders-service
                              │               │               │
                              └───────────────┴───────────────┘
                                              │
                                         PostgreSQL :5432
                                          (Docker)
```

### Services

| App | Port | Role |
|-----|------|------|
| `apps/api-gateway` | `5001` (HTTP/GraphQL) | The only public-facing app. Translates GraphQL ↔ gRPC. |
| `apps/auth-service` | `50051` (gRPC) | Register, login, JWT sign + verify. Owns the `users` table. |
| `apps/products-service` | `50052` (gRPC) | Product CRUD + server-streaming. Owns the `products` table. |
| `apps/orders-service` | `50053` (gRPC) | Order CRUD. Calls products-service to fetch prices. Owns `orders`. |
| `libs/proto` | — | Shared `.proto` files + TypeScript interfaces. Both client and server import from here. |

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Docker + Docker Compose (V2 — `docker compose`, no hyphen)
- PostgreSQL running locally **or** via the Docker stack below

---

## Quick start (local dev)

```bash
# 1. Clone and install
bun install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Start Postgres
docker compose up postgres -d --wait

# 4. Run all migrations (creates products, orders, users tables)
bun run db:migrate
bun run db:migrate:orders
bun run db:migrate:auth

# 5. Start all four services in one terminal (color-coded output)
bun run dev
```

Then open the **Apollo Sandbox** at **http://localhost:5001/graphql**.

---

## Run services individually

```bash
bun run start:auth        # auth-service   → gRPC on :50051
bun run start:products    # products-service → gRPC on :50052
bun run start:orders      # orders-service  → gRPC on :50053
bun run start:gateway     # api-gateway     → GraphQL on :5001
```

---

## Run the full stack with Docker

```bash
docker compose up --build         # build images + start everything
docker compose up --build -d      # same, detached
docker compose logs -f api-gateway  # tail gateway logs
docker compose down               # stop (data preserved in ./data/postgres)
```

Startup order: `postgres` → `auth-service` + `products-service` (parallel) → `orders-service` → `api-gateway`.

---

## GraphQL API

All operations at `POST http://localhost:5001/graphql`.
Open the embedded Apollo Sandbox at `GET http://localhost:5001/graphql`.

### Auth

```graphql
# Create an account — returns JWT
mutation {
  register(input: { email: "alice@example.com", password: "secret", name: "Alice" }) {
    accessToken
    user { id email name createdAt }
  }
}

# Login — returns JWT
mutation {
  login(input: { email: "alice@example.com", password: "secret" }) {
    accessToken
    user { id email }
  }
}

# Get current user (requires Authorization: Bearer <token> header)
query {
  me { userId email name }
}
```

### Products (reads are public; writes require JWT)

```graphql
query  { products { id name price stock } }
query  { product(id: "...") { id name price } }
query  { productsStream { id name } }   # server-streaming RPC demo

# Protected — add header: Authorization: Bearer <token>
mutation { createProduct(input: { name: "Widget", price: "9.99", stock: 100 }) { id } }
mutation { updateProduct(input: { id: "...", price: "7.99" }) { id price } }
mutation { deleteProduct(id: "...") { success } }
```

### Orders

```graphql
query  { orders { id productId quantity totalPrice status } }
query  { order(id: "...") { id status } }
mutation { createOrder(input: { productId: "...", quantity: 2 }) { id totalPrice } }
mutation { updateOrderStatus(input: { id: "...", status: "shipped" }) { id status } }
mutation { deleteOrder(id: "...") { success } }
```

---

## Database cheat-sheet

```bash
# Generate migration SQL from schema changes
bun run db:generate           # products table
bun run db:generate:orders    # orders table
bun run db:generate:auth      # users table

# Apply pending migrations
bun run db:migrate
bun run db:migrate:orders
bun run db:migrate:auth

# Open Drizzle Studio (visual DB browser) — Postgres must be running
bun run db:studio

# Connect directly with psql
docker compose exec postgres psql -U app -d ecommerce

# Wipe the database (irreversible)
docker compose down
rm -rf ./data/postgres
```

---

## Environment variables

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://app:...@localhost:5432/ecommerce` | Postgres connection string |
| `GATEWAY_PORT` | `5001` | api-gateway HTTP port |
| `AUTH_GRPC_PORT` | `50051` | auth-service gRPC port |
| `PRODUCTS_GRPC_PORT` | `50052` | products-service gRPC port |
| `ORDERS_GRPC_PORT` | `50053` | orders-service gRPC port |
| `JWT_SECRET` | *(required — no safe default in prod)* | HMAC-SHA256 key for JWT. Generate: `openssl rand -hex 32` |
| `AUTH_GRPC_URL` | unset (falls back to `localhost:50051`) | Override for Docker |
| `PRODUCTS_GRPC_URL` | unset (falls back to `localhost:50052`) | Override for Docker |
| `ORDERS_GRPC_URL` | unset (falls back to `localhost:50053`) | Override for Docker |

In Docker, the `*_GRPC_URL` vars are set automatically by `docker-compose.yml` to the container DNS names (`auth-service:50051` etc.). You do not need to set them locally.

---

## Project structure

```
nestjs-grpc/
├── apps/
│   ├── api-gateway/          HTTP/GraphQL server — the only public app
│   │   └── src/
│   │       ├── auth/         GraphQL register/login/me + JwtAuthGuard
│   │       ├── products/     GraphQL CRUD ↔ products-service gRPC
│   │       └── orders/       GraphQL CRUD ↔ orders-service gRPC
│   ├── auth-service/         gRPC server — JWT + bcrypt + users table
│   ├── products-service/     gRPC server — products table + streaming
│   └── orders-service/       gRPC server — orders table + S2S call to products
├── libs/
│   └── proto/                Shared .proto files + TypeScript interfaces
│       └── src/
│           ├── auth.proto
│           ├── products.proto
│           └── orders.proto
├── drizzle.config.ts         Products migration config
├── drizzle.orders.config.ts  Orders migration config
├── drizzle.auth.config.ts    Auth migration config
└── docker-compose.yml        Full stack: Postgres + all four services
```

---

## How JWT auth works

```
1. client calls `register` or `login` mutation
2. api-gateway forwards to auth-service via gRPC
3. auth-service hashes password (bcrypt, cost=12) and signs a JWT
4. JWT is returned to the client as `accessToken`

On protected mutations (createProduct, updateProduct, deleteProduct):
5. client sends:  Authorization: Bearer <accessToken>
6. JwtAuthGuard extracts the token
7. Gateway calls auth-service.ValidateToken via gRPC
8. auth-service verifies the JWT signature (secret never leaves auth-service)
9. Decoded payload { userId, email, name } attached to req.user
10. Resolver runs
```

---

## Learning roadmap (all complete)

| # | Step | What you learn |
|---|---|---|
| 1 | Monorepo + Bun foundation | Bun workspaces, NestJS structure, `@app/proto` alias |
| 2 | Docker + PostgreSQL + config | `docker-compose`, `@nestjs/config`, `.env` pattern |
| 3 | Drizzle schema + migrations | `pgTable`, `drizzle-kit generate/migrate`, typed queries |
| 4 | First gRPC service | `products.proto`, `@GrpcMethod`, `NestFactory.createMicroservice` |
| 5 | Gateway as gRPC client | `ClientsModule`, `Transport.GRPC`, Observable → Promise |
| 6 | Full Products CRUD | gRPC error codes, `RpcException`, partial updates |
| 7 | Orders + service-to-service | S2S gRPC calls, Drizzle transactions |
| 8 | Dockerize everything | Bun Dockerfiles, health checks, `depends_on: service_healthy` |
| 9 | Polish | Server-streaming RPC, `LoggingInterceptor`, Apollo Sandbox |
| + | Auth service | JWT, bcrypt, `JwtAuthGuard`, protected mutations |

---

## Conventions

- **Comments everywhere.** Files explain the *why*, not just the *what*. This is deliberate — it's teaching material.
- **JSONC vs JSON:** `.ts`, `tsconfig*.json`, `.yml`, `.env` carry comments. `package.json` and `nest-cli.json` are strict JSON — no comments or `bun install` / the Nest CLI breaks.
- **Price as string:** Monetary values use `numeric(10,2)` in Postgres (exact decimal), transmitted as strings through proto3 to avoid IEEE 754 float precision loss.
- **One env var per concern:** `PRODUCTS_GRPC_URL` / `ORDERS_GRPC_URL` / `AUTH_GRPC_URL` let the same code run in dev (localhost) and Docker (container DNS) without any code changes.
