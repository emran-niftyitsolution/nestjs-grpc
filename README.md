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

## API call flows

Numbered traces of every hop a request makes — useful for understanding exactly
which code runs and in what order.

---

### Flow 1 — `register` mutation (no auth required)

```
Client                  api-gateway              auth-service          PostgreSQL
  │                         │                         │                     │
  │  POST /graphql           │                         │                     │
  │  mutation register(...)  │                         │                     │
  ①─────────────────────────►│                         │                     │
  │                         │                         │                     │
  │                    ② Apollo Server parses GraphQL  │                     │
  │                    ③ routes to AuthResolver        │                     │
  │                    ④ calls AuthClientService       │                     │
  │                         │  gRPC Register(email,    │                     │
  │                         │  password, name)         │                     │
  │                         ⑤────────────────────────►│                     │
  │                         │                    ⑥ check email uniqueness    │
  │                         │                         ⑦──SELECT users──────►│
  │                         │                         │◄─────────────────────│
  │                         │                    ⑧ bcrypt.hash(password, 12) │
  │                         │                    ⑨ INSERT INTO users         │
  │                         │                         ⑩──INSERT────────────►│
  │                         │                         │◄── row returned ──────│
  │                         │                    ⑪ jwtService.sign(payload)  │
  │                         │  AuthResponse{           │                     │
  │                         │  accessToken, user}      │                     │
  │                         │◄─────────────────────────│                     │
  │  { accessToken, user }  │                         │                     │
  ①◄────────────────────────│                         │                     │
```

---

### Flow 2 — `products` query (public, no token needed)

```
Client                  api-gateway             products-service        PostgreSQL
  │                         │                         │                     │
  │  POST /graphql           │                         │                     │
  │  query { products }      │                         │                     │
  ①─────────────────────────►│                         │                     │
  │                    ② Apollo parses query            │                     │
  │                    ③ routes to ProductsResolver     │                     │
  │                    ④ (no guard — public query)      │                     │
  │                    ⑤ calls ProductsClientService    │                     │
  │                         │  gRPC FindAll({})         │                     │
  │                         ⑥────────────────────────►│                     │
  │                         │                    ⑦ SELECT * FROM products    │
  │                         │                         ⑧──────────────────►│
  │                         │                         │◄── rows ─────────────│
  │                         │                    ⑨ map rows → proto Product[] │
  │                         │  FindAllResponse{        │                     │
  │                         │  products: [...]}        │                     │
  │                         │◄─────────────────────────│                     │
  │  { data: { products }}  │                         │                     │
  ①◄────────────────────────│                         │                     │
```

---

### Flow 3 — `createProduct` mutation (protected — JWT required)

```
Client                  api-gateway   auth-service  products-service   PostgreSQL
  │                         │              │               │                │
  │  POST /graphql           │              │               │                │
  │  Authorization:          │              │               │                │
  │  Bearer <token>          │              │               │                │
  │  mutation createProduct  │              │               │                │
  ①─────────────────────────►│              │               │                │
  │                    ② Apollo parses mutation            │                │
  │                    ③ routes to ProductsResolver        │                │
  │                    ④ @UseGuards(JwtAuthGuard) fires     │                │
  │                    ⑤ guard extracts Bearer token        │                │
  │                         │  gRPC ValidateToken(token)    │                │
  │                         ⑥──────────────────────────────►               │
  │                         │  ⑦ jwtService.verify(token)   │                │
  │                         │  TokenPayload{userId,email}   │                │
  │                         │◄──────────────────────────────               │
  │                    ⑧ req.user = { userId, email, name }                 │
  │                    ⑨ guard returns true → resolver runs                  │
  │                    ⑩ calls ProductsClientService                        │
  │                         │  gRPC CreateProduct(input)    │                │
  │                         ⑪──────────────────────────────────────────────►│ (to products-service)
  │                         │               │    ⑫ INSERT INTO products     │
  │                         │               │               ⑬──────────────►│
  │                         │               │               │◄── new row ───│
  │                         │  Product{ id, name, price }   │                │
  │                         │◄──────────────────────────────────────────────│
  │  { data:{createProduct}}│              │               │                │
  ①◄────────────────────────│              │               │                │
```

> Without a token (or with an expired one): the guard throws at step ⑥ and
> the response is `{ errors: [{ message: "No authentication token provided" }] }`.
> The resolver and products-service are **never called**.

---

### Flow 4 — `createOrder` mutation (S2S call — orders calls products internally)

```
Client           api-gateway    orders-service   products-service   PostgreSQL
  │                   │               │                │                │
  │  mutation          │               │                │                │
  │  createOrder(      │               │                │                │
  │  productId,qty)    │               │                │                │
  ①──────────────────►│               │                │                │
  │              ② Apollo parses      │                │                │
  │              ③ OrdersResolver      │                │                │
  │              ④ OrdersClientService │                │                │
  │                   │  gRPC CreateOrder(productId,qty)│                │
  │                   ⑤──────────────►│                │                │
  │                   │         ⑥ OrdersService.createOrder()            │
  │                   │               │  gRPC FindOne(productId)         │
  │                   │               ⑦───────────────►│                │
  │                   │               │         ⑧ SELECT WHERE id=...   │
  │                   │               │                ⑨───────────────►│
  │                   │               │                │◄── product row ─│
  │                   │               │◄── Product{price} ───────────────│
  │                   │         ⑩ totalPrice = price × qty               │
  │                   │         ⑪ INSERT INTO orders                     │
  │                   │               ⑫───────────────────────────────►│
  │                   │               │◄────────────── new order row ────│
  │                   │  Order{id, totalPrice, status}  │                │
  │                   │◄──────────────│                │                │
  │  {data:{createOrder}} │            │                │                │
  ①◄──────────────────│               │                │                │
```

> Steps ⑦–⑨ are a **service-to-service (S2S) gRPC call** — orders-service acts
> as a gRPC *client* calling products-service, even though it is itself a gRPC
> *server* for api-gateway. This is how microservices compose.

---

### Flow 5 — `me` query (reads JWT payload from request context, no extra gRPC call)

```
Client                  api-gateway              auth-service
  │                         │                         │
  │  POST /graphql           │                         │
  │  Authorization:          │                         │
  │  Bearer <token>          │                         │
  │  query { me }            │                         │
  ①─────────────────────────►│                         │
  │                    ② Apollo parses query            │
  │                    ③ routes to AuthResolver.me()    │
  │                    ④ @UseGuards(JwtAuthGuard) fires  │
  │                    ⑤ guard extracts Bearer token     │
  │                         │  gRPC ValidateToken(token) │
  │                         ⑥────────────────────────►│
  │                         │  TokenPayload{           │
  │                         │  userId, email, name}    │
  │                         │◄─────────────────────────│
  │                    ⑦ req.user = TokenPayload        │
  │                    ⑧ resolver reads req.user        │
  │                    (no further gRPC or DB calls)     │
  │  { me:{userId,email,name}} │                        │
  ①◄────────────────────────│                         │
```

---

### Request layer summary

| Layer | File | What it does |
|---|---|---|
| GraphQL transport | Apollo Server (in api-gateway) | Parses query/mutation, routes to resolver |
| Guard | `jwt-auth.guard.ts` | Validates Bearer token via gRPC before resolver runs |
| Resolver | `*.resolver.ts` | Extracts GraphQL args, calls service |
| Gateway service | `*.service.ts` (gateway) | Wraps gRPC call, converts Observable → Promise |
| gRPC transport | `@nestjs/microservices` | Serializes/deserializes protobuf over HTTP/2 |
| Microservice controller | `*.controller.ts` | Receives RPC, delegates to service |
| Microservice service | `*.service.ts` (microservice) | Business logic + Drizzle query |
| ORM | Drizzle | Builds SQL, sends to Postgres |
| Database | PostgreSQL | Executes SQL, returns rows |

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
