/**
 * Shared card shell for every chart on Dashboard/Reports — keeps the
 * "rounded corners, soft shadow, surface background" card language
 * consistent between the KPI cards (`components/dashboard/stat-card.tsx`)
 * and the charts (`area-chart-card.tsx`, `donut-chart-card.tsx`,
 * `bar-chart-card.tsx`).
 */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-h4 font-semibold text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-small text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Consistent "nothing to show yet" state for a chart card — plainspoken,
 * matches the tone-of-voice guide in docs/02-brand-kit.md §4. */
export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center text-small text-text-muted">
      {message}
    </div>
  );
}
