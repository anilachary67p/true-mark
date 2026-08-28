import { cn } from './cn';

export function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-hope-dark">{label}</span>}
      <input
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-hope-dark outline-none transition placeholder:text-hope-muted focus:border-hope-primary focus:ring-2 focus:ring-hope-primary/15',
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-hope-dark">{label}</span>}
      <select
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-hope-dark outline-none transition focus:border-hope-primary focus:ring-2 focus:ring-hope-primary/15',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-hope-dark">{label}</span>}
      <textarea
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-hope-dark outline-none transition placeholder:text-hope-muted focus:border-hope-primary focus:ring-2 focus:ring-hope-primary/15',
          className,
        )}
        {...props}
      />
    </label>
  );
}
