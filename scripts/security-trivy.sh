#!/usr/bin/env bash
# Filesystem vulnerability scan + IaC misconfiguration scan. Ignores stray args from pnpm.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SEVERITY="${TRIVY_SEVERITY:-HIGH,CRITICAL}"
SKIP_DIRS="${TRIVY_SKIP_DIRS:-node_modules,.next,dist,.git}"

echo "[trivy] Filesystem scan (severity: $SEVERITY)"
trivy fs \
  --severity "$SEVERITY" \
  --skip-dirs "$SKIP_DIRS" \
  .

echo "[trivy] IaC / config scan (infra/)"
trivy config \
  --severity "$SEVERITY" \
  --ignorefile .trivyignore \
  infra/

echo "[trivy] No HIGH/CRITICAL findings"
