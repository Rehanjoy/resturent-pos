import { PercentIcon, ReceiptIcon, TrendUpIcon, WalletIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import type { DashboardSummary, DailyRevenue } from "@/lib/dashboard/types";
import { LiveOpsTiles } from "./live-ops-tiles";
import { PaymentModeDonut } from "./payment-mode-donut";
import { StatCard, type StatCardTrend } from "./stat-card";
import { TopDishesList } from "./top-dishes-list";
import { AnalyticsCard, RankedBars, RevenueLineChart } from "./analytics-charts";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeGrossRevenueTrend(weeklyTrend: DailyRevenue[]): StatCardTrend | null {
  if (weeklyTrend.length < 2) return null;
  const today = weeklyTrend[weeklyTrend.length - 1]!.grossRevenue;
  const yesterday = weeklyTrend[weeklyTrend.length - 2]!.grossRevenue;
  if (yesterday <= 0) return null;
  const changePercent = ((today - yesterday) / yesterday) * 100;
  return { direction: changePercent >= 0 ? "up" : "down", label: `${Math.abs(Math.round(changePercent))}% vs yesterday` };
}

function dayLabel(date: string): string {
  return WEEKDAY[new Date(`${date}T00:00:00`).getDay()] ?? date;
}

export function EarningsPanel({ summary, canViewInventory }: { summary: DashboardSummary; canViewInventory: boolean }) {
  const { salesSummary, paymentModeBreakdown, liveOps, topDishes, topCategories, weeklyTrend } = summary;
  const averageOrderValue = salesSummary.invoiceCount > 0 ? Math.round(salesSummary.netRevenue / salesSummary.invoiceCount) : 0;
  const taxRate = salesSummary.grossRevenue > 0 ? Math.round((salesSummary.totalTax / salesSummary.grossRevenue) * 1000) / 10 : 0;

  return (
    <div className="space-y-5" role="tabpanel" id="dashboard-panel-earnings" aria-labelledby="dashboard-tab-earnings">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross revenue today" value={formatMoney(salesSummary.grossRevenue)} icon={WalletIcon} trend={computeGrossRevenueTrend(weeklyTrend) ?? undefined} />
        <StatCard label="Settled orders" value={String(salesSummary.invoiceCount)} icon={ReceiptIcon} />
        <StatCard label="Average order value" value={formatMoney(averageOrderValue)} icon={TrendUpIcon} />
        <StatCard label="Discounts given" value={formatMoney(salesSummary.totalDiscounts)} icon={PercentIcon} tone={salesSummary.totalDiscounts > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DetailMetric label="Net revenue" value={formatMoney(salesSummary.netRevenue)} helper="After discounts" />
        <DetailMetric label="Tax collected" value={formatMoney(salesSummary.totalTax)} helper={`${taxRate}% of gross revenue`} />
        <DetailMetric label="Revenue per settlement" value={formatMoney(averageOrderValue)} helper={`${salesSummary.invoiceCount} settled bill${salesSummary.invoiceCount === 1 ? "" : "s"}`} />
      </div>

      <LiveOpsTiles liveOps={liveOps} lowStockCount={summary.lowStockCount} canViewInventory={canViewInventory} />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <AnalyticsCard title="7-day revenue trend" subtitle="Daily gross revenue from settled bills">
          <RevenueLineChart data={weeklyTrend.map((day) => ({ label: dayLabel(day.date), value: day.grossRevenue }))} />
        </AnalyticsCard>
        <PaymentModeDonut breakdown={paymentModeBreakdown} title="Payment collection" subtitle="Today by payment mode" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Revenue by category" subtitle="Highest earning menu categories today">
          <RankedBars
            data={topCategories.slice(0, 6).map((category) => ({ key: category.categoryId, label: category.name, value: category.revenue, detail: `${category.qtySold} item${category.qtySold === 1 ? "" : "s"} sold`, tone: "secondary" }))}
            valueFormatter={formatMoney}
            emptyMessage="Category revenue will appear after the first bill is settled."
          />
        </AnalyticsCard>
        <AnalyticsCard title="Best-selling dishes" subtitle="Dish revenue and portions sold today">
          <RankedBars
            data={topDishes.slice(0, 6).map((dish) => ({ key: dish.menuItemId, label: dish.name, value: dish.revenue, detail: `${dish.qtySold} portion${dish.qtySold === 1 ? "" : "s"}` }))}
            valueFormatter={formatMoney}
            emptyMessage="Dish performance will appear after the first bill is settled."
          />
        </AnalyticsCard>
      </div>

      <TopDishesList dishes={topDishes} categories={topCategories} />
    </div>
  );
}

function DetailMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-1 tabular-nums text-body font-semibold text-text">{value}</p>
      <p className="mt-0.5 text-[11px] text-text-muted">{helper}</p>
    </div>
  );
}
