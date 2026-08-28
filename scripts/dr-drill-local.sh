#!/usr/bin/env bash
# Local DR drill: backup PostgreSQL, restore to scratch DB, run integrity checks.
# Requires: pg_dump, psql, DATABASE_URL (postgresql://...)
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_FILE="${BACKUP_FILE:-/tmp/truemark_dr_backup.sql}"
DRILL_DB="${DRILL_DB:-truemark_dr_drill}"
START_TS=$(date +%s)

echo "[DR drill] Starting backup → restore → integrity validation"

pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_FILE"
echo "[DR drill] Backup written: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE") bytes)"

BASE_URL="${DATABASE_URL%%\?*}"
RESTORE_URL="${BASE_URL%/*}/${DRILL_DB}"

psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DRILL_DB};"
psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DRILL_DB};"
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 < "$BACKUP_FILE"
echo "[DR drill] Restored to database: $DRILL_DB"

run_check() {
  local label="$1"
  local sql="$2"
  local count
  count=$(psql "$RESTORE_URL" -t -A -v ON_ERROR_STOP=1 -c "$sql")
  echo "  $label: $count"
  if [[ "$count" != "0" ]]; then
    echo "[DR drill] FAIL integrity check: $label" >&2
    exit 1
  fi
}

echo "[DR drill] Integrity checks (expect 0 for each):"
run_check "orphaned_qr_codes" \
  "SELECT count(*) FROM qr_codes qr LEFT JOIN product_units pu ON pu.id = qr.product_unit_id WHERE pu.id IS NULL;"
run_check "orphaned_verification_events" \
  "SELECT count(*) FROM verification_events ve LEFT JOIN tenants t ON t.id = ve.tenant_id WHERE t.id IS NULL;"
run_check "orphaned_credentials" \
  "SELECT count(*) FROM verification_credentials vc LEFT JOIN product_units pu ON pu.id = vc.product_unit_id WHERE pu.id IS NULL;"

TENANT_COUNT=$(psql "$RESTORE_URL" -t -A -c "SELECT count(*) FROM tenants;")
EVENT_COUNT=$(psql "$RESTORE_URL" -t -A -c "SELECT count(*) FROM verification_events;")
E2E_QR=$(psql "$RESTORE_URL" -t -A -c "SELECT count(*) FROM qr_codes WHERE token = 'e2eFixedQrToken0001';")

echo "[DR drill] Restored tenant count: $TENANT_COUNT"
echo "[DR drill] Restored verification events: $EVENT_COUNT"
echo "[DR drill] E2E fixture QR present: $E2E_QR"

if [[ "$TENANT_COUNT" -lt 1 ]]; then
  echo "[DR drill] FAIL: no tenants in restored database" >&2
  exit 1
fi

END_TS=$(date +%s)
RTO_SEC=$((END_TS - START_TS))
echo "[DR drill] PASS — RTO for local drill: ${RTO_SEC}s"

psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DRILL_DB};"
echo "[DR drill] Cleaned up drill database"
