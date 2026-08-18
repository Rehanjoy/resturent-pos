import { formatMoney } from "@/lib/format";
import type { PaymentModeAmount } from "@/lib/dashboard/types";

const MODE_LABEL: Record<PaymentModeAmount["mode"], string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
};

/**
 * Deliberately a plain CSS bar list rather than a charting library — three
 * bars don't justify the bundle-size cost of a charting dependency (see
 * `dashboard-screen.tsx` doc comment for the same call on the weekly trend).
 */
export function PaymentModeBar({ breakdown }: { breakdown: PaymentModeAmount[] }) {
  const max = Math.max(1, ...breakdown.map((entry) => entry.amount));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="font-heading text-h4 font-semibold text-text">Payment Mode Breakdown</h3>
      <div className="flex flex-col gap-2">
        {breakdown.map((entry) => (
          <div key={entry.mode} className="flex items-center gap-3">
            <span className="w-12 text-small text-text-muted">{MODE_LABEL[entry.mode]}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${(entry.amount / max) * 100}%` }}
              />
            </div>
            <span className="w-20 text-right text-small font-medium tabular-nums text-text">
              {formatMoney(entry.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
