export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="py-10 text-center">
      {icon && <div className="mb-3 flex justify-center text-hope-secondary opacity-50">{icon}</div>}
      <h3 className="text-base font-semibold text-hope-dark">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-hope-secondary">{description}</p>}
    </div>
  );
}
