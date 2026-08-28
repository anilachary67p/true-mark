import { cn } from './cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('hope-card', className)}>{children}</div>;
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn('text-base font-bold text-hope-dark', className)}>{children}</h3>;
}
