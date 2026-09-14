import { formatMoney } from "@/lib/format";

export interface RankedBarDatum {
  key: string;
  label: string;
  value: number;
  detail?: string;
  tone?: "primary" | "secondary" | "info" | "warning" | "error";
}

const BAR_TONES: Record<NonNullable<RankedBarDatum["tone"]>, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
};

export function AnalyticsCard({ title, subtitle, children, className = "" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${className}`}>
      <div className="mb-5">
        <h2 className="font-heading text-h4 font-semibold text-text">{title}</h2>
        {subtitle ? <p className="mt-1 text-small text-text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function RankedBars({ data, valueFormatter, emptyMessage }: {
  data: RankedBarDatum[];
  valueFormatter: (value: number) => string;
  emptyMessage: string;
}) {
  const maximum = Math.max(...data.map((entry) => entry.value), 0);
  if (data.length === 0 || maximum <= 0) return <DashboardEmptyState message={emptyMessage} />;

  return (
    <ol className="space-y-4">
      {data.map((entry) => (
        <li key={entry.key}>
          <div className="mb-1.5 flex items-end justify-between gap-3 text-small">
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{entry.label}</p>
              {entry.detail ? <p className="truncate text-[11px] text-text-muted">{entry.detail}</p> : null}
            </div>
            <span className="shrink-0 tabular-nums font-semibold text-text">{valueFormatter(entry.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-background" aria-hidden="true">
            <div
              className={`h-full rounded-full ${BAR_TONES[entry.tone ?? "primary"]}`}
              style={{ width: `${Math.max((entry.value / maximum) * 100, 3)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RevenueLineChart({ data }: { data: { label: string; value: number }[] }) {
  const width = 720;
  const height = 250;
  const padding = { top: 18, right: 16, bottom: 38, left: 62 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(...data.map((entry) => entry.value), 0);
  if (data.length === 0 || maximum <= 0) {
    return <DashboardEmptyState message="No settled sales were recorded in the last 7 days." />;
  }

  const points = data.map((entry, index) => ({
    ...entry,
    x: padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - (entry.value / maximum) * chartHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding.left},${padding.top + chartHeight} ${line} ${padding.left + chartWidth},${padding.top + chartHeight}`;

  return (
    <div className="overflow-x-auto pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] min-w-[620px] w-full" role="img" aria-label="Gross revenue for each of the last seven days">
        <defs>
          <linearGradient id="dashboard-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={padding.left + chartWidth} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="5 7" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">{formatCompactMoney(Math.round(maximum * ratio))}</text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#dashboard-revenue-fill)" />
        <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="3">
              <title>{`${point.label}: ${formatMoney(point.value)}`}</title>
            </circle>
            <text x={point.x} y={height - 13} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatCompactMoney(value: number): string {
  const rupees = value / 100;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(0)}k`;
  return `₹${Math.round(rupees)}`;
}

export function DistributionRing({ segments, totalLabel }: {
  segments: { label: string; value: number; color: string }[];
  totalLabel: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return <DashboardEmptyState message="No inventory items are available to analyse." />;

  const stops = segments.reduce<{ stops: string[]; cursor: number }>((result, segment) => {
    const end = result.cursor + (segment.value / total) * 100;
    return {
      cursor: end,
      stops: [...result.stops, `${segment.color} ${result.cursor}% ${end}%`],
    };
  }, { stops: [], cursor: 0 }).stops;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }} role="img" aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")} />
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-surface text-center shadow-inner">
          <strong className="font-heading text-h2 text-text">{total}</strong>
          <span className="text-[11px] text-text-muted">{totalLabel}</span>
        </div>
      </div>
      <ul className="space-y-3">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-small">
            <span className="flex items-center gap-2 text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} aria-hidden="true" />
              {segment.label}
            </span>
            <strong className="tabular-nums text-text">{segment.value} · {Math.round((segment.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-5 text-center">
      <p className="max-w-sm text-small text-text-muted">{message}</p>
    </div>
  );
}

export function DashboardErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-error/25 bg-error/5 p-6 text-center">
      <p className="text-body font-medium text-error">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl border border-error/30 bg-surface px-5 text-small font-semibold text-error hover:bg-error/5">Retry now</button>
    </div>
  );
}

export function DashboardLoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}
