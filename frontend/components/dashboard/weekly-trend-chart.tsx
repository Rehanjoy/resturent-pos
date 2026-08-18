import { formatMoney } from "@/lib/format";
import type { DailyRevenue } from "@/lib/dashboard/types";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Simple CSS bar chart — no charting dependency for 7 bars (see
 * `payment-mode-bar.tsx` for the same call). */
export function WeeklyTrendChart({ days }: { days: DailyRevenue[] }) {
  const max = Math.max(1, ...days.map((day) => day.grossRevenue));

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="font-heading text-h4 font-semibold text-text">Last 7 Days — Gross Revenue</h3>
      <div className="mt-4 flex h-32 items-end gap-2">
        {days.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          const heightPercent = (day.grossRevenue / max) * 100;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] text-text-muted">{formatMoney(day.grossRevenue)}</span>
              <div className="flex h-20 w-full items-end">
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${Math.max(heightPercent, day.grossRevenue > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="text-small text-text-muted">{WEEKDAY[date.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
