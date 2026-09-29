import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'soft';

const variants: Record<Variant, string> = {
  primary: 'bg-hope-primary text-white hover:bg-hope-primary-dark shadow-sm shadow-hope-primary/20',
  secondary: 'bg-hope-primary-light text-hope-primary hover:bg-hope-primary/15',
  outline: 'border border-slate-200 bg-white text-hope-dark hover:bg-slate-50',
  danger: 'bg-hope-danger text-white hover:bg-red-700',
  ghost: 'text-hope-secondary hover:bg-slate-100',
  soft: 'bg-hope-primary-light text-hope-primary hover:bg-hope-primary/15',
};

export function Button({
  children,
  variant = 'primary',
  className,
  size = 'md',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'px-3.5 py-2 text-xs rounded-xl',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-5 py-3 text-sm rounded-xl',
  };
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
