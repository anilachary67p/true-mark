import { BadRequestException } from '@nestjs/common';

export type DateRange = { from: Date; to: Date };

export function parseDateRange(from?: string, to?: string, defaultDays = 30): DateRange {
  const end = to ? startOfDay(parseIsoDate(to, 'to')) : endOfDay(new Date());
  const start = from
    ? startOfDay(parseIsoDate(from, 'from'))
    : startOfDay(new Date(end.getTime() - (defaultDays - 1) * 86_400_000));

  if (start > end) {
    throw new BadRequestException('from must be on or before to');
  }

  const maxSpanMs = 366 * 86_400_000;
  if (end.getTime() - start.getTime() > maxSpanMs) {
    throw new BadRequestException('Date range cannot exceed 366 days');
  }

  return { from: start, to: endOfDay(end) };
}

function parseIsoDate(value: string, field: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function eachDayInRange(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Previous period of equal length immediately before `range`. */
export function previousDateRange(range: DateRange): DateRange {
  const spanMs = range.to.getTime() - range.from.getTime();
  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: startOfDay(prevFrom), to: endOfDay(prevTo) };
}

export function metricDelta(current: number, previous: number) {
  const delta = current - previous;
  const deltaPercent =
    previous > 0
      ? Math.round((delta / previous) * 1000) / 10
      : current > 0
        ? 100
        : 0;
  return { current, previous, delta, deltaPercent };
}
