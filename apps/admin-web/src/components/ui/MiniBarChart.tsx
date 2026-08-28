import { cn } from './cn';

const BAR_COLORS = ['bg-hope-primary', 'bg-hope-teal', 'bg-hope-purple', 'bg-hope-info', 'bg-hope-primary/60'];

export function MiniBarChart({ className }: { className?: string }) {
  const heights = [40, 65, 45, 80, 55, 70, 50, 90, 60, 75, 48, 85];
  return (
    <div className={cn('flex h-12 items-end gap-1', className)}>
      {heights.map((h, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-sm opacity-80', BAR_COLORS[i % BAR_COLORS.length])}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
