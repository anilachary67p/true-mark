import { cn } from './cn';

export function Alert({
  children,
  variant = 'success',
  className,
}: {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'info';
  className?: string;
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return (
    <div className={cn('mb-4 rounded-lg border px-4 py-3 text-sm', styles[variant], className)}>
      {children}
    </div>
  );
}
