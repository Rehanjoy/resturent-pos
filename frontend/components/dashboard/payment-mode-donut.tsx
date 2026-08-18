import { formatMoney } from "@/lib/format";
import type { PaymentModeAmount } from "@/lib/dashboard/types";
import { DonutChartCard } from "@/components/charts/donut-chart-card";

const MODE_LABEL: Record<PaymentModeAmount["mode"], string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
};

// Categorical chart colors — deliberately primary/secondary/info, not
// `--color-accent` (reserved exclusively for the one CTA per screen per
// docs/02-brand-kit.md) and not success/warning/error (reserved for KDS
// urgency + validation states elsewhere in the app).
const MODE_COLOR: Record<PaymentModeAmount["mode"], string> = {
  cash: "var(--color-secondary)",
  card: "var(--color-primary)",
  upi: "var(--color-info)",
};

/** Payment-mode-split donut, shared by the Dashboard and the Reports
 * "Revenue by Payment Mode" tab (both consume the same `PaymentModeAmount[]`
 * shape from the backend). */
export function PaymentModeDonut({
  breakdown,
  title = "Payment Mode Split",
  subtitle,
}: {
  breakdown: PaymentModeAmount[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <DonutChartCard
      title={title}
      subtitle={subtitle}
      totalLabel="Total"
      valueFormatter={formatMoney}
      emptyMessage="No payments recorded yet."
      data={breakdown.map((entry) => ({
        key: entry.mode,
        label: MODE_LABEL[entry.mode],
        value: entry.amount,
        color: MODE_COLOR[entry.mode],
      }))}
    />
  );
}
