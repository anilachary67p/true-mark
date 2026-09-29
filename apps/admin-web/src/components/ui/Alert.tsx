import { cn } from './cn';

export function Alert({
  children,
  variant = 'success',
  className,
}: {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'info' | 'warning';
  className?: string;
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  const isUrgent = variant === 'error' || variant === 'warning';
  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className={cn('mb-4 rounded-lg border px-4 py-3 text-sm', styles[variant], className)}
    >
      {children}
    </div>
  );
}
