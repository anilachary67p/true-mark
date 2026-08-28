#!/usr/bin/env bash
# Run unit tests (Jest) + E2E tests (Playwright) against local Docker stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://truemark:truemark_dev@localhost:5433/truemark?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-minimum-32-characters-long}"
export AUTH_MODE="${AUTH_MODE:-dev}"
export STORAGE_PROVIDER="${STORAGE_PROVIDER:-local}"
export AI_PROVIDER="${AI_PROVIDER:-mock}"
export NODE_ENV="${NODE_ENV:-test}"
export API_URL="${API_URL:-http://127.0.0.1:3001}"
export ADMIN_WEB_URL="${ADMIN_WEB_URL:-http://127.0.0.1:3000}"
export CONSUMER_WEB_URL="${CONSUMER_WEB_URL:-http://127.0.0.1:3002}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001}"
export NEXT_PUBLIC_VERIFY_HOSTNAME="${NEXT_PUBLIC_VERIFY_HOSTNAME:-verify.localhost}"

API_PID=""
ADMIN_PID=""
CONSUMER_PID=""

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$ADMIN_PID" ]] && kill "$ADMIN_PID" 2>/dev/null || true
  [[ -n "$CONSUMER_PID" ]] && kill "$CONSUMER_PID" 2>/dev/null || true
}
trap cleanup EXIT

free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "[tests] Freeing port $port (pid: $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "[tests] $label is ready ($url)"
      return 0
    fi
    sleep 2
  done
  echo "[tests] $label failed to start at $url" >&2
  return 1
}

echo "=== [1/6] Docker infrastructure ==="
bash "$ROOT/scripts/docker-up.sh"

echo "=== [2/6] Database schema + seed ==="
pnpm db:generate
pnpm db:push
pnpm db:seed

echo "=== [3/6] Build packages ==="
pnpm --filter @truemark/config build
pnpm --filter @truemark/shared build
pnpm --filter @truemark/db build
pnpm --filter @truemark/api build
NODE_ENV=production pnpm --filter @truemark/admin-web build
NODE_ENV=production NEXT_PUBLIC_VERIFY_HOSTNAME="$NEXT_PUBLIC_VERIFY_HOSTNAME" \
  NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" pnpm --filter @truemark/consumer-web build

echo "=== [4/6] Unit tests (Jest — API) ==="
pnpm --filter @truemark/api test

echo "=== [5/6] Start application servers ==="
free_port 3001
free_port 3000
free_port 3002
pnpm --filter @truemark/api start &
API_PID=$!
pnpm --filter @truemark/admin-web start &
ADMIN_PID=$!
NEXT_PUBLIC_VERIFY_HOSTNAME="$NEXT_PUBLIC_VERIFY_HOSTNAME" NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  pnpm --filter @truemark/consumer-web start &
CONSUMER_PID=$!

wait_for_url "$API_URL/api/v1/health/ready" "API"
wait_for_url "$ADMIN_WEB_URL/login" "Admin Web"
wait_for_url "$CONSUMER_WEB_URL/verify" "Consumer Web"

echo "=== [6/6] E2E tests (Playwright) ==="
pnpm --filter @truemark/e2e exec playwright install chromium --with-deps 2>/dev/null || \
  pnpm --filter @truemark/e2e exec playwright install chromium
pnpm test:e2e

echo ""
echo "All tests passed."
