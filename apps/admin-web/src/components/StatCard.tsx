import { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { MiniBarChart } from '@/components/ui/MiniBarChart';

const ACCENT: Record<string, string> = {
  primary: 'text-hope-primary',
  success: 'text-hope-success',
  warning: 'text-hope-warning',
  error: 'text-hope-danger',
  info: 'text-hope-info',
  secondary: 'text-hope-secondary',
};

export function StatCard({
  label,
  value,
  color = 'primary',
  icon: Icon,
  footer,
  showChart = true,
  action,
}: {
  label: string;
  value: string | number;
  color?: keyof typeof ACCENT;
  icon?: LucideIcon;
  footer?: string;
  showChart?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="hope-card flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={cn('rounded-lg bg-hope-primary-light p-2', ACCENT[color])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <p className="text-sm font-medium text-hope-secondary">{label}</p>
        </div>
        {action ?? (
          <button type="button" className="text-xs font-semibold text-hope-primary hover:underline">
            View
          </button>
        )}
      </div>

      <p className="text-3xl font-bold tracking-tight text-hope-dark">{value}</p>

      {footer && <p className="mt-1 text-xs text-hope-muted">{footer}</p>}

      {showChart && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <MiniBarChart />
        </div>
      )}
    </div>
  );
}
