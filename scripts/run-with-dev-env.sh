#!/usr/bin/env bash
# Run any command with repo .env + local Docker defaults loaded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

# Keep the caller's working directory (pnpm runs dev scripts from each package).
exec "$@"
