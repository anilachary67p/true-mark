'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatDeltaPercent, toFiniteNumber } from '@/lib/format';

export type MetricDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
};

export function DeltaStatCard({
  label,
  metric,
  footer,
  accent = 'primary',
}: {
  label: string;
  metric?: Partial<MetricDelta> | null;
  footer?: string;
  accent?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}) {
  const current = toFiniteNumber(metric?.current);
  const previous = toFiniteNumber(metric?.previous);
  const delta = metric?.delta === undefined ? current - previous : toFiniteNumber(metric.delta);
  const deltaPercent = previous === 0 ? (current === 0 ? 0 : null) : metric?.deltaPercent;
  const positive = delta > 0;
  const negative = delta < 0;
  const neutral = delta === 0;

  const accentBorder = {
    primary: 'border-l-hope-primary',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    error: 'border-l-red-500',
    info: 'border-l-sky-500',
  }[accent];

  return (
    <div className={cn('hope-card border-l-4 p-5', accentBorder)}>
      <p className="text-sm font-medium text-hope-secondary">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-hope-dark">
        {current.toLocaleString()}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {neutral ? (
          <Minus className="h-4 w-4 text-hope-muted" />
        ) : positive ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <span
          className={cn(
            'text-xs font-semibold',
            neutral && 'text-hope-muted',
            positive && 'text-emerald-600',
            negative && 'text-red-500',
          )}
        >
          {positive ? '+' : ''}
          {delta.toLocaleString()}
          {deltaPercent === null ? ' (new)' : ` (${formatDeltaPercent(deltaPercent)})`}
        </span>
        <span className="text-[10px] text-hope-muted">vs prior period</span>
      </div>
      {footer && <p className="mt-2 text-xs text-hope-muted">{footer}</p>}
      <p className="mt-1 text-[10px] text-hope-muted">
        Previous: {previous.toLocaleString()}
      </p>
    </div>
  );
}
