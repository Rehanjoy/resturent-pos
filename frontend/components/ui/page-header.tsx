/**
 * Shared "title + muted subtitle" header used at the top of every admin
 * screen (Dashboard, Reports, and — as this pattern gets rolled out further
 * — Tables/Orders/Menu/etc). Server-renderable: takes plain `ReactNode` so
 * a caller that needs a live clock/date can supply a small client
 * component as `subtitle` without forcing this component itself to be a
 * client component.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-h1">{title}</h1>
        {subtitle && <p className="mt-1 text-small text-text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2 [&>div]:flex-wrap">{action}</div>}
    </div>
  );
}
