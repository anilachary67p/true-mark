const EMPTY = '—';

function toValidDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Locale date + time; renders an em dash instead of "Invalid Date". */
export function formatDateTime(value: unknown): string {
  return toValidDate(value)?.toLocaleString() ?? EMPTY;
}

/** Locale date only; renders an em dash instead of "Invalid Date". */
export function formatDate(value: unknown): string {
  return toValidDate(value)?.toLocaleDateString() ?? EMPTY;
}

/** Finite number or 0 — guards charts and totals against NaN / Infinity / strings. */
export function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value: unknown): string {
  return toFiniteNumber(value).toLocaleString();
}

/** Percentage of `part` in `total`, clamped to 0–100 and safe for total = 0. */
export function percentOf(part: unknown, total: unknown): number {
  const t = toFiniteNumber(total);
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, (toFiniteNumber(part) / t) * 100));
}

/** Signed, rounded percent change label (e.g. "+12.5%"); "—" when not meaningful. */
export function formatDeltaPercent(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}
