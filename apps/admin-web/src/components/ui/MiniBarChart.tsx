import { cn } from './cn';

const BAR_COLORS = [
  'bg-hope-primary',
  'bg-hope-teal',
  'bg-hope-purple',
  'bg-hope-info',
  'bg-hope-primary/60',
  'bg-emerald-500',
  'bg-amber-500',
];

export function MiniBarChart({
  values,
  className,
  maxHeight = 100,
}: {
  values?: number[];
  className?: string;
  maxHeight?: number;
}) {
  const data = values && values.length > 0 ? values : [0];
  const max = Math.max(...data, 1);

  return (
    <div className={cn('flex h-full min-h-[120px] items-end gap-1.5', className)}>
      {data.map((value, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn('w-full rounded-sm opacity-90 transition-all', BAR_COLORS[i % BAR_COLORS.length])}
            style={{ height: `${Math.max(4, (value / max) * maxHeight)}%` }}
            title={String(value)}
          />
        </div>
      ))}
    </div>
  );
}
