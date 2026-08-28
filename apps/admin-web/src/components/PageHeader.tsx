export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-hope-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-hope-secondary">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3 lg:justify-end">{action}</div>}
    </div>
  );
}
