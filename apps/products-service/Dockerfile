# ===========================================================================
# apps/products-service/Dockerfile
#
# Same monorepo context strategy as api-gateway/Dockerfile — read that file's
# header for the full rationale. Short version: build context = repo root so
# Docker can see libs/ alongside the app source.
# ===========================================================================

FROM oven/bun:1.3-alpine
WORKDIR /app

# Layer 1 — dependency manifest (least-changing)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Layer 2 — TypeScript config (path aliases: @app/proto → libs/proto/src)
COPY tsconfig.json ./

# Layer 3 — Drizzle migration config for this service.
# drizzle.config.ts points to apps/products-service/src/db/schema.ts and
# apps/products-service/src/db/migrations/. It is at the REPO ROOT and is
# read by `bunx drizzle-kit migrate` at container startup.
COPY drizzle.config.ts ./

# Layer 4 — shared library
COPY libs/ ./libs/

# Layer 5 — application source (most frequently changed)
COPY apps/products-service/ ./apps/products-service/

# gRPC port (not HTTP — there is no HTTP server in this service).
EXPOSE 50052

# ---------------------------------------------------------------------------
# CMD — run migrations then start the gRPC server.
#
# WHY run migrations at startup:
#   In a real production deploy, migrations run separately (a pre-deploy job
#   or a migration container) so a rollback doesn't re-run migrations
#   and so you have a single migration run across N replicas. For this
#   learning project, running them at startup is the simplest approach and
#   matches how many small teams operate: `drizzle-kit migrate` is idempotent
#   (it only applies pending migrations) so re-running is safe.
#
# WHY shell form (sh -c) instead of exec form for this CMD:
#   We need two commands separated by `&&` ("run migrate, THEN start only if
#   migrate succeeds"). Exec form only runs a single binary. Shell form runs
#   the full line inside /bin/sh which understands `&&`. The trade-off:
#   PID 1 is sh, not Bun — signals are handled by sh on Alpine. For a
#   learning setup this is fine; for production use an entrypoint script.
# ---------------------------------------------------------------------------
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun apps/products-service/src/main.ts"]
