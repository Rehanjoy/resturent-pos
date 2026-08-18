import type { ReportRange, ReportRangeParams } from "@/lib/reports/types";

const RANGE_LABEL: Record<ReportRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 Days",
  month: "This Month",
  custom: "Custom",
};

const RANGE_OPTIONS: ReportRange[] = ["today", "yesterday", "7d", "month", "custom"];

export function RangeFilter({
  params,
  onChange,
}: {
  params: ReportRangeParams;
  onChange: (params: ReportRangeParams) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {RANGE_OPTIONS.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => onChange({ range, from: params.from, to: params.to })}
            className={`rounded-full px-3.5 py-1.5 text-small font-medium transition-colors ${
              params.range === range
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-background hover:text-text"
            }`}
          >
            {RANGE_LABEL[range]}
          </button>
        ))}
      </div>

      {params.range === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={params.from ?? ""}
            onChange={(e) => onChange({ ...params, from: e.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1 text-small text-text"
          />
          <span className="text-small text-text-muted">to</span>
          <input
            type="date"
            value={params.to ?? ""}
            onChange={(e) => onChange({ ...params, to: e.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1 text-small text-text"
          />
        </div>
      )}
    </div>
  );
}
