import { AlertTriangleIcon, BoxIcon, ClockIcon, WalletIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import type { InventoryItem } from "@/lib/inventory/types";
import { AnalyticsCard, DistributionRing, RankedBars } from "./analytics-charts";
import { StatCard } from "./stat-card";

export function InventoryPanel({ items }: { items: InventoryItem[] }) {
  const healthy = items.filter((item) => item.stockAlert === "healthy").length;
  const warning = items.filter((item) => item.stockAlert === "warning").length;
  const critical = items.filter((item) => item.stockAlert === "critical").length;
  const stockValue = items.reduce((sum, item) => sum + Math.max(0, Math.round(item.currentStock * item.costPerUnit)), 0);
  const daysValues = items.map((item) => item.daysRemaining).filter((days): days is number => days !== null && Number.isFinite(days));
  const averageCoverage = daysValues.length > 0 ? daysValues.reduce((sum, days) => sum + days, 0) / daysValues.length : null;
  const usedTodayCount = items.filter((item) => (item.today?.used ?? 0) > 0).length;
  const wastedTodayCount = items.filter((item) => (item.today?.wasted ?? 0) > 0).length;

  return (
    <div className="space-y-5" role="tabpanel" id="dashboard-panel-inventory" aria-labelledby="dashboard-tab-inventory">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ingredients tracked" value={String(items.length)} icon={BoxIcon} />
        <StatCard label="Current stock value" value={formatMoney(stockValue)} icon={WalletIcon} />
        <StatCard label="Items needing action" value={String(warning + critical)} icon={AlertTriangleIcon} tone={critical > 0 ? "error" : warning > 0 ? "warning" : "success"} />
        <StatCard label="Average stock cover" value={averageCoverage === null ? "—" : `${averageCoverage.toFixed(1)} days`} icon={ClockIcon} tone={averageCoverage !== null && averageCoverage < 3 ? "warning" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InventoryMetric label="Used today" value={String(usedTodayCount)} helper="Ingredients with recorded usage" />
        <InventoryMetric label="Waste today" value={String(wastedTodayCount)} helper="Ingredients with recorded waste" />
        <InventoryMetric label="Reorders requested" value={String(items.filter((item) => item.reorderRequested).length)} helper="Awaiting purchasing action" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Stock health" subtitle="Current ingredient status by reorder threshold">
          <DistributionRing totalLabel="ingredients" segments={[
            { label: "Healthy", value: healthy, color: "var(--color-success)" },
            { label: "Warning", value: warning, color: "var(--color-warning)" },
            { label: "Critical", value: critical, color: "var(--color-error)" },
          ]} />
        </AnalyticsCard>
        <AnalyticsCard title="Highest stock value" subtitle="Current quantity × latest cost per unit">
          <RankedBars
            data={[...items].map((item) => ({ ...item, value: Math.max(0, Math.round(item.currentStock * item.costPerUnit)) })).sort((a, b) => b.value - a.value).slice(0, 8).map((item) => ({ key: item.id, label: item.name, value: item.value, detail: `${formatNumber(item.currentStock)} ${item.unit} in stock`, tone: "secondary" }))}
            valueFormatter={formatMoney}
            emptyMessage="Add ingredient quantities and purchase rates to calculate stock value."
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Lowest stock coverage" subtitle="Items likely to run out first at expected daily usage">
        <RankedBars
          data={[...items].filter((item) => item.daysRemaining !== null).sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0)).slice(0, 10).map((item) => ({ key: item.id, label: item.name, value: item.daysRemaining ?? 0, detail: `${formatNumber(item.currentStock)} ${item.unit} remaining · ${formatNumber(item.expectedDailyUsage)} ${item.unit}/day`, tone: item.stockAlert === "critical" ? "error" : item.stockAlert === "warning" ? "warning" : "primary" }))}
          valueFormatter={(value) => `${value.toFixed(1)} days`}
          emptyMessage="Enter expected daily usage to calculate days of stock remaining."
        />
      </AnalyticsCard>
    </div>
  );
}

function InventoryMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p><p className="mt-1 tabular-nums text-body font-semibold text-text">{value}</p><p className="mt-0.5 text-[11px] text-text-muted">{helper}</p></div>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
}
