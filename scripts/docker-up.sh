#!/usr/bin/env bash
# Start local infrastructure (Postgres, Redis, MinIO) via Docker Compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"

echo "[docker-up] Pulling images..."
docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures \
  || echo "[docker-up] Pull failed; using locally cached images"

echo "[docker-up] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[docker-up] Waiting for Postgres on localhost:5433..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U truemark -d truemark >/dev/null 2>&1; then
    echo "[docker-up] Postgres is ready"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "[docker-up] Postgres did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

echo "[docker-up] Services:"
docker compose -f "$COMPOSE_FILE" ps

cat <<EOF

Infrastructure is up:
  Postgres  → localhost:5433  (user: truemark, password: truemark_dev, db: truemark)
  Redis     → localhost:6379
  MinIO     → localhost:9000  (console: 9001, minioadmin/minioadmin)

Export before running API:
  export DATABASE_URL='postgresql://truemark:truemark_dev@localhost:5433/truemark?schema=public'
  export REDIS_URL='redis://localhost:6379'
  export JWT_SECRET='dev-jwt-secret-minimum-32-characters-long'
  export AUTH_MODE=dev
  export STORAGE_PROVIDER=local
  export AI_PROVIDER=mock

Then: pnpm db:push && pnpm db:seed
EOF
