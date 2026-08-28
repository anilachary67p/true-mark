#!/usr/bin/env bash
# Start all apps in dev mode via Turbo. Ignores stray args from pnpm.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "[dev] Freeing port $port (pid: $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "[dev] Force-killing port $port (pid: $pids)"
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi
  fi
  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "[dev] ERROR: port $port is still in use. Run: lsof -nP -iTCP:$port -sTCP:LISTEN" >&2
    exit 1
  fi
}

free_port 3000
free_port 3001
free_port 3002

exec turbo run dev
