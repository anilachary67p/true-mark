import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

export function PageCard({
  title,
  children,
  action,
  noPadding,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('mb-5', className)}>
      {noPadding ? (
        children
      ) : (
        <CardBody>
          {(title || action) && (
            <div className="mb-5 flex items-center justify-between">
              {title && <CardTitle>{title}</CardTitle>}
              {action}
            </div>
          )}
          {children}
        </CardBody>
      )}
    </Card>
  );
}
