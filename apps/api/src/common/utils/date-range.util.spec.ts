import { BadRequestException } from '@nestjs/common';
import {
  eachDayInRange,
  parseDateRange,
  parseDateRangeFromDates,
  toDateKey,
} from './date-range.util';

describe('parseDateRange', () => {
  it('defaults to the last 30 days when params are omitted', () => {
    const range = parseDateRange();
    const days = eachDayInRange(range.from, range.to);
    expect(days.length).toBeGreaterThanOrEqual(29);
    expect(days.length).toBeLessThanOrEqual(31);
  });

  it('parses explicit from/to values', () => {
    const range = parseDateRange('2026-08-01', '2026-08-10');
    expect(toDateKey(range.from)).toBe('2026-08-01');
    expect(toDateKey(range.to)).toBe('2026-08-10');
  });

  it('rejects invalid ranges', () => {
    expect(() => parseDateRange('2026-08-10', '2026-08-01')).toThrow(BadRequestException);
  });

  it('builds ranges from local Date values without ISO timezone drift', () => {
    const start = new Date(2026, 7, 1, 15, 30, 0);
    const end = new Date(2026, 7, 10, 9, 45, 0);
    const range = parseDateRangeFromDates(start, end);
    expect(toDateKey(range.from)).toBe('2026-08-01');
    expect(toDateKey(range.to)).toBe('2026-08-10');
  });
});
