import { cn } from './cn';

const colors: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  PROCESSED: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  SUSPENDED: 'bg-red-50 text-red-700',
  DISABLED: 'bg-slate-100 text-slate-600',
  REVOKED: 'bg-red-50 text-red-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  OPEN: 'bg-amber-50 text-amber-700',
  UNDER_REVIEW: 'bg-sky-50 text-sky-700',
  SUSPICIOUS: 'bg-amber-50 text-amber-700',
  POSSIBLE_CLONE: 'bg-red-50 text-red-700',
  INVALID: 'bg-slate-100 text-slate-600',
  HIGH: 'bg-red-50 text-red-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  LOW: 'bg-slate-100 text-slate-600',
  default: 'bg-slate-100 text-slate-600',
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
        colors[status] ?? colors.default,
      )}
    >
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}
