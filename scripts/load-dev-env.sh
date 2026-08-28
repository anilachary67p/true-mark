#!/usr/bin/env bash
# Load repo .env (if present) and apply local Docker defaults for missing vars.
# Usage: source this file from other scripts (does not exec).

_truemark_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$_truemark_root/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$_truemark_root/.env"
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://truemark:truemark_dev@localhost:5433/truemark?schema=public}"

# Docker Compose maps Postgres to host port 5433. A root .env that still
# points at 5432 (local Postgres) will fail auth against the Compose stack.
if [[ "${TRUEMARK_USE_HOST_POSTGRES:-}" != "1" && "${DATABASE_URL}" == *"@localhost:5432/"* ]]; then
  echo "[env] DATABASE_URL uses localhost:5432; switching to Docker Postgres on :5433" >&2
  echo "[env] Set TRUEMARK_USE_HOST_POSTGRES=1 to keep port 5432." >&2
  export DATABASE_URL='postgresql://truemark:truemark_dev@localhost:5433/truemark?schema=public'
fi
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-minimum-32-characters-long}"
export AUTH_MODE="${AUTH_MODE:-dev}"
export STORAGE_PROVIDER="${STORAGE_PROVIDER:-local}"
export AI_PROVIDER="${AI_PROVIDER:-mock}"
export NEXT_PUBLIC_VERIFY_HOSTNAME="${NEXT_PUBLIC_VERIFY_HOSTNAME:-verify.localhost}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001}"

# License (dev keys — never use in production)
if [[ -f "$_truemark_root/infra/dev/license-keys.json" ]]; then
  export LICENSE_SIGNING_PUBLIC_KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$_truemark_root/infra/dev/license-keys.json','utf8')).publicKeyPem)")"
  export LICENSE_SIGNING_PRIVATE_KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$_truemark_root/infra/dev/license-keys.json','utf8')).privateKeyPem)")"
  export LICENSE_BACKUP_KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$_truemark_root/infra/dev/license-keys.json','utf8')).backupKey)")"
fi
export INSTALLATION_ID="${INSTALLATION_ID:-truemark-dev-instance}"
export PRODUCT_OWNER_EMAIL="${PRODUCT_OWNER_EMAIL:-licensing@truemark.local}"
export PRODUCT_OWNER_PHONE="${PRODUCT_OWNER_PHONE:-+1-800-TRUE-MARK}"
export LICENSE_DIR="${LICENSE_DIR:-$_truemark_root}"
