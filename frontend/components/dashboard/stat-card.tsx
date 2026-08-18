import type { IconProps } from "@/components/icons";
import { TrendDownIcon, TrendUpIcon } from "@/components/icons";

export interface StatCardTrend {
  direction: "up" | "down";
  /** e.g. "12% vs yesterday" — the caller computes the number from real
   * data; this component only renders it. */
  label: string;
}

const TONE_TEXT: Record<"default" | "success" | "error" | "warning", string> = {
  default: "text-text",
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
};

const TONE_CHIP: Record<"default" | "success" | "error" | "warning", string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
  warning: "bg-warning/10 text-warning",
};

/**
 * KPI card: label, big number, a small icon chip in the corner, and an
 * optional trend caption — matches the reference screenshots' stat-card
 * language. `tone` colors both the value and the icon chip (defaults to
 * brand primary).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  trend,
}: {
  label: string;
  value: string;
  icon?: (props: IconProps) => React.ReactElement;
  tone?: "default" | "success" | "error" | "warning";
  trend?: StatCardTrend;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-small text-text-muted">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`font-heading text-h2 font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
      {trend && (
        <p
          className={`flex items-center gap-1 text-small ${
            trend.direction === "up" ? "text-success" : "text-error"
          }`}
        >
          {trend.direction === "up" ? (
            <TrendUpIcon className="h-3.5 w-3.5" />
          ) : (
            <TrendDownIcon className="h-3.5 w-3.5" />
          )}
          {trend.label}
        </p>
      )}
    </div>
  );
}
