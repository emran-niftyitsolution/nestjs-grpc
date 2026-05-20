# ===========================================================================
# apps/api-gateway/Dockerfile
#
# WHY build context is the REPO ROOT (not this app's folder):
#   This is a monorepo. api-gateway imports from `@app/proto` which resolves
#   to `libs/proto/src/` (see root tsconfig.json "paths"). That lib lives
#   outside this app's directory, so Docker must be able to see it. We tell
#   Docker to send the full repo root as the build context (in compose:
#   `context: .`) and use this file as the Dockerfile.
#
# Build layers and caching — the golden rule:
#   Put the things that CHANGE LEAST near the top, things that change MOST
#   near the bottom. Docker caches each layer (RUN/COPY instruction result)
#   and only rebuilds from the first invalidated layer downward.
#
#   So: package.json + lockfile first → RUN install → source files last.
#   This means editing a .ts file doesn't trigger a full `bun install` again.
# ===========================================================================

# ---------------------------------------------------------------------------
# Stage: runtime  (single-stage — this is a learner project, not production)
#
# WHY oven/bun: the official Bun image. We pin the minor version (1.3) so we
# don't silently pick up a breaking major change, but still get patch updates.
#
# WHY NOT multi-stage build (build + runner stages):
#   In a production setup you'd use a build stage to produce a binary (`bun
#   build --compile`) and a minimal runner stage (scratch or distroless) with
#   no Bun runtime, reducing the final image to ~10 MB. Here, because we run
#   TypeScript directly (no compile step), we NEED the full Bun runtime in the
#   final image. Multi-stage is shown in the README as a "next steps" topic.
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-alpine

# All subsequent commands run inside /app.
# WORKDIR creates the directory if it doesn't exist.
WORKDIR /app

# ---------------------------------------------------------------------------
# Layer 1 — dependency manifest (changes rarely)
# Copy ONLY the lockfile and package.json BEFORE copying source.
# WHY: if we copied everything first, any .ts change would bust this layer and
# force a full reinstall. By copying just these two files, `bun install` only
# re-runs when the dependency list actually changes.
# ---------------------------------------------------------------------------
COPY package.json bun.lock ./

# ---------------------------------------------------------------------------
# Layer 2 — install dependencies (cached until package.json/bun.lock change)
#
# --frozen-lockfile: fail if bun.lock is out of sync with package.json.
#   WHY: a missing or stale lockfile produces non-deterministic installs —
#   different machines (or CI runs) might get different package versions.
#   Forcing the lockfile to be in sync means "this image is reproducible."
#
# WHY install BEFORE copying source:
#   node_modules is ~GB of files. If we invalidate this layer every time a
#   .ts file changes, every build re-downloads the internet.
# ---------------------------------------------------------------------------
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Layer 3 — TypeScript path alias config (changes when we add/remove aliases)
# Root tsconfig.json defines "@app/proto" → "libs/proto/src".
# Bun reads tsconfig.json at startup to resolve these aliases.
# ---------------------------------------------------------------------------
COPY tsconfig.json ./

# ---------------------------------------------------------------------------
# Layer 4 — shared library (changes when proto contract changes)
# libs/proto/src contains the .proto files AND the TypeScript interfaces.
# Both api-gateway AND the microservices share this lib — changes here affect
# every service, so it's a reasonable cache bust boundary.
# ---------------------------------------------------------------------------
COPY libs/ ./libs/

# ---------------------------------------------------------------------------
# Layer 5 — application source (changes most frequently)
# Only copy the api-gateway app, not the other services. Keeping the build
# context tight means editing orders-service doesn't bust this layer.
# ---------------------------------------------------------------------------
COPY apps/api-gateway/ ./apps/api-gateway/

# Declare the port the gateway listens on. EXPOSE is documentation only —
# it doesn't actually publish the port. The real binding happens in Compose
# under `ports:`. Without EXPOSE, `docker inspect` and tooling can't know
# which ports the container uses.
EXPOSE 5001

# ---------------------------------------------------------------------------
# CMD — the default command when the container starts.
#
# Exec form (JSON array): preferred because:
#   - PID 1 is the Bun process itself (not a shell wrapper). This means
#     Docker stop / Kubernetes SIGTERM goes DIRECTLY to Bun, giving it a
#     chance to flush connections cleanly.
#   - Shell form would be: CMD bun apps/api-gateway/src/main.ts  (but then
#     PID 1 is /bin/sh, which doesn't forward signals to children).
#
# WHY no migration step here:
#   api-gateway is a pure GraphQL/gRPC client — it has NO database of its
#   own and no schema to migrate. Migrations live in products-service and
#   orders-service (the services that OWN the data).
# ---------------------------------------------------------------------------
CMD ["bun", "apps/api-gateway/src/main.ts"]
