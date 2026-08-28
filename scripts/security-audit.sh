#!/usr/bin/env bash
# Dependency audit (high+ severity). Ignores stray args from pnpm.
set -euo pipefail
pnpm audit --audit-level=high
