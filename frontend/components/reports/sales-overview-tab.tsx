import { formatMoney } from "@/lib/format";
import type { SalesReport } from "@/lib/reports/types";

export function SalesOverviewTab({ report }: { report: SalesReport }) {
  const { totals } = report;
  const maxHour = Math.max(1, ...report.revenueByHour.map((h) => h.revenue));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Gross Revenue" value={formatMoney(totals.grossRevenue)} />
        <Stat label="Net Revenue" value={formatMoney(totals.netRevenue)} />
        <Stat label="Tax Collected" value={formatMoney(totals.totalTax)} />
        <Stat label="Discounts" value={formatMoney(totals.totalDiscounts)} />
        <Stat label="Invoices" value={String(totals.invoiceCount)} />
      </div>

      {report.isSingleDay ? (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <h3 className="font-heading text-h4 font-semibold text-text">Revenue by Hour</h3>
          <div className="mt-3 flex h-28 items-end gap-1 overflow-x-auto">
            {report.revenueByHour.map((h) => (
              <div key={h.hour} className="flex min-w-[20px] flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${(h.revenue / maxHour) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-muted">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-small text-text-muted">
          Revenue by hour is only shown for single-day ranges (Today or Yesterday).
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
      <p className="text-small text-text-muted">{label}</p>
      <p className="font-heading text-h4 font-semibold text-text">{value}</p>
    </div>
  );
}
