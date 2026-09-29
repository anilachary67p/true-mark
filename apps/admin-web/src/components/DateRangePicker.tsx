'use client';

import { Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DATE_RANGE_PRESETS,
  DateRangePreset,
  DateRangeValue,
  rangeForDays,
  rangeForPreset,
} from '@/lib/dateRange';
import { cn } from '@/components/ui/cn';

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  className?: string;
}) {
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  function applyPreset(next: DateRangePreset) {
    setPreset(next);
    if (next === 'custom') return;
    onChange(rangeForPreset(next));
  }

  const rangeError = validateRange(custom);

  function applyCustom() {
    if (!rangeError && (custom.from !== value.from || custom.to !== value.to)) {
      onChange(custom);
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {DATE_RANGE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyPreset(item.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              preset === item.id
                ? 'bg-hope-primary text-white shadow-sm'
                : 'text-hope-secondary hover:bg-slate-50 hover:text-hope-dark',
            )}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset('custom')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            preset === 'custom'
              ? 'bg-hope-primary text-white shadow-sm'
              : 'text-hope-secondary hover:bg-slate-50 hover:text-hope-dark',
          )}
        >
          Custom
        </button>
      </div>

      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Calendar className="h-4 w-4 text-hope-muted" />
        <input
          type="date"
          aria-label="From date"
          aria-invalid={!!rangeError}
          value={custom.from}
          max={custom.to || undefined}
          onChange={(e) => {
            setPreset('custom');
            setCustom((prev) => ({ ...prev, from: e.target.value }));
          }}
          onBlur={applyCustom}
          className="border-0 bg-transparent text-xs font-medium text-hope-dark outline-none"
        />
        <span className="text-xs text-hope-muted">to</span>
        <input
          type="date"
          aria-label="To date"
          aria-invalid={!!rangeError}
          value={custom.to}
          min={custom.from || undefined}
          onChange={(e) => {
            setPreset('custom');
            setCustom((prev) => ({ ...prev, to: e.target.value }));
          }}
          onBlur={applyCustom}
          className="border-0 bg-transparent text-xs font-medium text-hope-dark outline-none"
        />
      </div>
      {rangeError && (
        <p role="alert" className="w-full text-xs font-medium text-hope-danger">
          {rangeError}
        </p>
      )}
    </div>
  );
}

const MAX_RANGE_DAYS = 366;

function validateRange(range: DateRangeValue): string | null {
  if (!range.from || !range.to) return 'Select both a start and an end date.';
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 'Enter valid dates.';
  if (from > to) return 'Start date must be on or before the end date.';
  if (to - from > MAX_RANGE_DAYS * 86_400_000) return `Date range cannot exceed ${MAX_RANGE_DAYS} days.`;
  return null;
}

export function getDefaultDateRange(days = 30) {
  return rangeForDays(days);
}
