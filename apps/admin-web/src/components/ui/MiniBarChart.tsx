import { toFiniteNumber } from '@/lib/format';
import { cn } from './cn';

const BAR_COLORS = [
  'bg-hope-primary',
  'bg-hope-teal',
  'bg-hope-purple',
  'bg-hope-info',
  'bg-hope-primary/70',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
];

const CHART_HEIGHT = 112;

export function MiniBarChart({
  values,
  labels,
  className,
  height = CHART_HEIGHT,
  showGrid = true,
}: {
  values?: number[];
  labels?: string[];
  className?: string;
  height?: number;
  showGrid?: boolean;
}) {
  const data = Array.isArray(values) ? values.map((v) => Math.max(0, toFiniteNumber(v))) : [];
  const max = data.reduce((m, v) => Math.max(m, v), 1);
  const hasLabels = labels && labels.length === data.length;

  if (data.length === 0 || data.every((v) => v === 0)) {
    return (
      <div
        className={cn('flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-hope-muted', className)}
        style={{ height }}
      >
        {data.length === 0 ? 'No data yet' : 'No activity in this period'}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="relative" style={{ height }}>
        {showGrid && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map((line) => (
              <div key={line} className="border-t border-slate-100/90" />
            ))}
          </div>
        )}
        <div className="relative flex h-full items-end gap-1.5 px-0.5">
          {data.map((value, i) => {
            const barHeight = value === 0 ? 2 : Math.max(6, Math.round((value / max) * (height - 8)));
            return (
              <div
                key={`${i}-${value}`}
                className="group flex min-w-0 flex-1 flex-col items-center justify-end"
              >
                <div
                  className={cn(
                    'w-full max-w-[48px] rounded-t-md opacity-90 shadow-sm transition-all group-hover:opacity-100',
                    BAR_COLORS[i % BAR_COLORS.length],
                  )}
                  style={{ height: barHeight }}
                  title={labels?.[i] ? `${labels[i]}: ${value.toLocaleString()}` : String(value)}
                />
              </div>
            );
          })}
        </div>
      </div>
      {hasLabels && (
        <div className="mt-2 flex gap-1.5 px-0.5">
          {labels!.map((label, i) => (
            <p
              key={`${label}-${i}`}
              className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-hope-muted"
              title={label}
            >
              {label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
