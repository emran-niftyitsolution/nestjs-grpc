# ===========================================================================
# apps/orders-service/Dockerfile
#
# Identical structure to products-service/Dockerfile. The differences:
#   - drizzle.orders.config.ts instead of drizzle.config.ts
#   - Port 50052 (orders-service) instead of 50051 (products-service)
#   - Migration command uses --config drizzle.orders.config.ts
#
# WHY separate drizzle config files (one per service):
#   Each service OWNS its own schema and migration history independently.
#   drizzle.config.ts manages the `products` table migration lineage.
#   drizzle.orders.config.ts manages the `orders` table migration lineage.
#   This mirrors real microservices: each team (service) controls its own DB
#   schema evolution, never the other team's. In Docker each service only
#   runs its own migrations at startup — products-service never touches the
#   orders migration history and vice versa.
# ===========================================================================

FROM oven/bun:1.3-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./

# orders-service uses its own drizzle config (different schema path + out dir)
COPY drizzle.orders.config.ts ./

COPY libs/ ./libs/
COPY apps/orders-service/ ./apps/orders-service/

EXPOSE 50052

CMD ["sh", "-c", "bunx drizzle-kit migrate --config drizzle.orders.config.ts && bun apps/orders-service/src/main.ts"]
