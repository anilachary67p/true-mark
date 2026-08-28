#!/usr/bin/env bash
# Run a @truemark/db script with local Docker env defaults.
# Usage: bash scripts/with-dev-env.sh seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

if [[ $# -eq 0 ]]; then
  echo "Usage: bash scripts/with-dev-env.sh <db-script> [args...]" >&2
  echo "  e.g. bash scripts/with-dev-env.sh seed" >&2
  exit 1
fi

cd "$ROOT"
exec pnpm --filter @truemark/db "$@"
