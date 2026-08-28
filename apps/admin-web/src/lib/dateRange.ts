export type DateRangeValue = {
  from: string;
  to: string;
};

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

export const DATE_RANGE_PRESETS: Array<{ id: DateRangePreset; label: string; days: number }> = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
];

export function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: DateRangePreset): DateRangeValue {
  if (preset === 'custom') {
    return rangeForDays(30);
  }
  const days = DATE_RANGE_PRESETS.find((p) => p.id === preset)?.days ?? 30;
  return rangeForDays(days);
}

export function rangeForDays(days: number): DateRangeValue {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

export function formatRangeLabel(range: DateRangeValue): string {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;
}

export function buildDateQuery(range?: DateRangeValue): string {
  if (!range?.from && !range?.to) return '';
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
