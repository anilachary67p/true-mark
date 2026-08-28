#!/usr/bin/env bash
# Run all local security scans (pnpm audit + Trivy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/security-audit.sh"
bash "$ROOT/scripts/security-trivy.sh"

echo ""
echo "Security scans completed successfully."
