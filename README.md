# nestjs-grpc — a step-by-step gRPC learning project

A guided, heavily-commented project that teaches **gRPC** by building a simple
e-commerce backend. Every file is commented to explain *why* the code is the
way it is — this repo is teaching material, read the comments.

> ⚠️ This is **not** the generic NestJS starter README anymore. The commands
> below are the real ones for this project (we use **Bun**, a **monorepo**,
> and **docker-compose** — not `npm run start`).

## Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime / package manager | **Bun** | Runs `.ts` directly, no build step in dev |
| Framework | **NestJS 11** (monorepo) | First-class gRPC + DI + module system |
| Transport | **gRPC** (`@grpc/grpc-js`) | The thing we're here to learn |
| Database | **PostgreSQL 18** (Docker) | Real DB, one command to run |
| ORM / migrations | **Drizzle** | Typed schema + SQL migrations |
| Infra | **docker-compose** | Reproducible local Postgres (apps too, Step 8) |

## Architecture

```
            HTTP/REST                     gRPC
 client  ───────────────►  api-gateway  ─────────►  products-service  ──►  Postgres
 (curl)                    (port 3000)              (gRPC only)            (Docker)
                           the ONLY public app      no public HTTP
```

- **`apps/api-gateway`** — the only app exposed publicly. Speaks HTTP to the
  world, gRPC to internal services.
- **`apps/products-service`** — speaks gRPC only; owns the database.
- **`libs/proto`** — the shared `.proto` contract both apps depend on.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Docker with the standalone **`docker-compose`** binary
  (this project uses `docker-compose ...`, not the `docker compose` subcommand)

## Setup

```bash
cp .env.example .env        # create your local config
bun install                 # install dependencies
docker-compose up -d --wait # start Postgres, block until healthy
```

## Run the apps (dev)

Two terminals — Bun runs the TypeScript directly with hot reload:

```bash
bun run start:gateway       # http://localhost:3000
bun run start:products      # http://localhost:3001  (becomes gRPC in Step 4)
```

Smoke test:

```bash
curl localhost:3000/health
curl localhost:3001/health   # shows DB url with the password masked
```

## Database / Docker cheat-sheet

```bash
docker-compose up -d --wait                         # start + wait healthy
docker-compose ps                                   # status
docker-compose logs -f postgres                     # tail DB logs
docker-compose exec postgres psql -U app -d ecommerce  # SQL shell
docker-compose down                                 # stop containers (data safe in ./data/postgres/)
docker-compose down -v                              # same — data STILL safe (bind mount; -v only removes named volumes)
rm -rf ./data/postgres                              # the ONLY way to intentionally wipe the DB
```

## Learning roadmap

| # | Step | Status |
|---|---|---|
| 1 | Monorepo + Bun foundation | ✅ done |
| 2 | Docker + PostgreSQL + `@nestjs/config` | ✅ done |
| 3 | Drizzle: `products` schema, migrations, typed DB client | ⏭️ next |
| 4 | First gRPC service: `products.proto`, gRPC server | |
| 5 | Gateway as gRPC client (REST ↔ gRPC bridge) | |
| 6 | Full Products CRUD + validation + gRPC↔HTTP errors | |
| 7 | Orders domain: relations, transactions, service-to-service gRPC | |
| 8 | Dockerize everything (Bun Dockerfiles, full compose) | |
| 9 | gRPC health/reflection/streaming + recap | |

## Conventions

- **Comments everywhere.** Files explain the *why*, not just the *what*.
- **Comment-capable vs not:** `.ts`, `tsconfig*.json` (JSONC), `.yml`, `.env`,
  `.mjs` carry comments. `package.json` and `nest-cli.json` are **strict JSON**
  — adding comments there breaks `bun install` / the Nest CLI, so those are
  documented here and in chat instead.
- **One step at a time.** Each step is built, explained, and verified before
  moving on.
