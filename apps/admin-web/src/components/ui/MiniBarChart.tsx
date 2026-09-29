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

const DECORATIVE_BARS = [22, 38, 28, 52, 34, 46, 30, 44, 26, 40, 36, 48];

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
  const data = values && values.length > 0 ? values : DECORATIVE_BARS;
  const max = Math.max(...data, 1);
  const hasLabels = labels && labels.length === data.length;

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
            const barHeight = Math.max(6, Math.round((value / max) * (height - 8)));
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
