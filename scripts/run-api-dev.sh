#!/usr/bin/env bash
# Start Nest API in watch mode with local Docker env loaded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

cd "$ROOT/apps/api"
exec pnpm exec nest start --watch
