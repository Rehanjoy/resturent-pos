import { formatMoney } from "@/lib/format";
import type { SalesReport } from "@/lib/reports/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { PercentIcon, ReceiptIcon, TrendUpIcon, WalletIcon } from "@/components/icons";

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour} ${period}`;
}

export function SalesOverviewTab({ report }: { report: SalesReport }) {
  const { totals } = report;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Gross Revenue" value={formatMoney(totals.grossRevenue)} icon={WalletIcon} />
        <StatCard label="Net Revenue" value={formatMoney(totals.netRevenue)} icon={TrendUpIcon} />
        <StatCard label="Tax Collected" value={formatMoney(totals.totalTax)} icon={ReceiptIcon} />
        <StatCard
          label="Discounts"
          value={formatMoney(totals.totalDiscounts)}
          icon={PercentIcon}
          tone={totals.totalDiscounts > 0 ? "warning" : "default"}
        />
        <StatCard label="Invoices" value={String(totals.invoiceCount)} icon={ReceiptIcon} />
      </div>

      {report.isSingleDay ? (
        <AreaChartCard
          title="Revenue by Hour"
          data={report.revenueByHour.map((h) => ({ label: formatHourLabel(h.hour), value: h.revenue }))}
          valueFormatter={formatMoney}
          emptyMessage="No sales recorded in this range yet."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-5 text-small text-text-muted shadow-sm">
          Revenue by hour is only shown for single-day ranges (Today or Yesterday).
        </div>
      )}
    </div>
  );
}
