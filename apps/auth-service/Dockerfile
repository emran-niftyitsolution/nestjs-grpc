# ===========================================================================
# apps/auth-service/Dockerfile
#
# Identical structure to orders-service/Dockerfile. The differences:
#   - drizzle.auth.config.ts instead of drizzle.orders.config.ts
#   - Port 50051 (auth-service) instead of 50052
#   - Migration command uses --config drizzle.auth.config.ts
#   - Does NOT copy apps/products-service or apps/orders-service — only this
#     service's source lands in the image, keeping the build context tight.
#
# WHY auth-service runs its own migration at startup (not at build time):
#   Running `drizzle-kit migrate` at BUILD time would need a live DATABASE_URL
#   during `docker build`, which is usually unavailable in CI and wrong
#   for a layered architecture. Deferring to startup (CMD) means the container
#   migrates against the real DB it will use, and migrations are idempotent —
#   running them twice is safe because Drizzle tracks applied migrations.
#
# Build context: the REPO ROOT (not this app's folder).
#   WHY: COPY libs/ would fail if context were set to apps/auth-service/ because
#   libs/ lives outside that directory. docker-compose.yml sets context: . to
#   give Docker access to the entire repo. See docker-compose.yml for details.
# ===========================================================================

FROM oven/bun:1.3-alpine
WORKDIR /app

# Layer 1 — dependency manifest (cached until package.json or bun.lock change)
COPY package.json bun.lock ./

# Layer 2 — install (only re-runs when dependencies actually change)
RUN bun install --frozen-lockfile

# Layer 3 — TypeScript config (path alias @app/proto → libs/proto/src)
COPY tsconfig.json ./

# Layer 4 — auth-service drizzle config (needed by the migration CMD below)
COPY drizzle.auth.config.ts ./

# Layer 5 — shared proto library (proto files + TypeScript interfaces)
COPY libs/ ./libs/

# Layer 6 — auth-service application source (changes most frequently)
COPY apps/auth-service/ ./apps/auth-service/

# Document the gRPC port this container listens on.
EXPOSE 50051

# Start: migrate the users table first, then start the gRPC server.
# `sh -c "cmd1 && cmd2"` — if migrations fail, the server does NOT start,
# preventing a container that accepts connections before the DB is ready.
CMD ["sh", "-c", "bunx drizzle-kit migrate --config drizzle.auth.config.ts && bun apps/auth-service/src/main.ts"]
