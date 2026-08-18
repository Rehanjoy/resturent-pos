"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { dashboardApi } from "@/lib/dashboard/api";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { PercentIcon, ReceiptIcon, TrendUpIcon, WalletIcon } from "@/components/icons";
import { StatCard, type StatCardTrend } from "./stat-card";
import { PaymentModeDonut } from "./payment-mode-donut";
import { LiveOpsTiles } from "./live-ops-tiles";
import { TopDishesList } from "./top-dishes-list";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import type { DailyRevenue } from "@/lib/dashboard/types";

// PRD §2 Dashboard column: Owner/Manager "Full", Cashier "View" — every
// other role has no access at all (matches the nav rail's role filter and
// the backend's `authorize()` guard on GET /api/dashboard/summary).
const DASHBOARD_ROLES = new Set(["owner", "manager", "cashier"]);

// Inventory RBAC (PRD §2 Inventory column) — Cashier can see this
// dashboard but has no Inventory access at all, so the low-stock tile
// below is rendered as a non-link for that role. See `live-ops-tiles.tsx`.
const INVENTORY_VIEW_ROLES = new Set(["owner", "manager", "inventory_manager", "chef"]);

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Today-vs-yesterday gross revenue trend, computed from the real 7-day
 * `weeklyTrend` series the backend already returns (last element is always
 * today — see `sales-analytics.service.ts` `aggregateDailyRevenue`, which
 * fills every day in range including zero-revenue ones, so the array is
 * always contiguous). Returns `null` rather than a misleading "+Infinity%"
 * when yesterday had zero revenue to compare against.
 */
function computeGrossRevenueTrend(weeklyTrend: DailyRevenue[]): StatCardTrend | null {
  if (weeklyTrend.length < 2) return null;
  const today = weeklyTrend[weeklyTrend.length - 1]!.grossRevenue;
  const yesterday = weeklyTrend[weeklyTrend.length - 2]!.grossRevenue;
  if (yesterday <= 0) return null;

  const changePercent = ((today - yesterday) / yesterday) * 100;
  const direction: StatCardTrend["direction"] = changePercent >= 0 ? "up" : "down";
  return { direction, label: `${Math.abs(Math.round(changePercent))}% vs yesterday` };
}

export function DashboardScreen() {
  const { user } = useAuth();
  const canView = !!user && DASHBOARD_ROLES.has(user.role);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardApi.getSummary().then((result) => result.summary),
    enabled: canView,
    // Live ops in particular should feel current without a manual refresh.
    refetchInterval: 30_000,
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to the dashboard.</p>
      </main>
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader title="Dashboard" subtitle="Loading today's numbers…" />
        <p className="mt-8 text-small text-text-muted">Loading dashboard…</p>
      </main>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader title="Dashboard" />
        <p className="mt-8 text-small text-error">
          Could not load the dashboard — check your connection and try again.
        </p>
      </main>
    );
  }

  const { salesSummary, paymentModeBreakdown, liveOps, topDishes, topCategories, weeklyTrend } =
    summaryQuery.data;

  // Safe to compute directly (no SSR/hydration risk) — this component only
  // ever renders once `AdminLayout`'s auth gate has already flipped to
  // "authenticated" client-side (see that file's doc comment).
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const avgOrderValue =
    salesSummary.invoiceCount > 0 ? Math.round(salesSummary.netRevenue / salesSummary.invoiceCount) : 0;

  const revenueTrend = computeGrossRevenueTrend(weeklyTrend);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader title="Dashboard" subtitle={todayLabel} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gross Revenue Today"
          value={formatMoney(salesSummary.grossRevenue)}
          icon={WalletIcon}
          trend={revenueTrend ?? undefined}
        />
        <StatCard
          label="Orders Settled Today"
          value={String(salesSummary.invoiceCount)}
          icon={ReceiptIcon}
          tone="default"
        />
        <StatCard
          label="Avg Order Value"
          value={formatMoney(avgOrderValue)}
          icon={TrendUpIcon}
          tone="default"
        />
        <StatCard
          label="Discounts Given"
          value={formatMoney(salesSummary.totalDiscounts)}
          icon={PercentIcon}
          tone={salesSummary.totalDiscounts > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-small text-text-muted">
        <span>
          Net Revenue: <span className="font-medium text-text">{formatMoney(salesSummary.netRevenue)}</span>
        </span>
        <span>
          Tax Collected: <span className="font-medium text-text">{formatMoney(salesSummary.totalTax)}</span>
        </span>
      </div>

      <LiveOpsTiles
        liveOps={liveOps}
        lowStockCount={summaryQuery.data.lowStockCount}
        canViewInventory={INVENTORY_VIEW_ROLES.has(user.role)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentModeDonut breakdown={paymentModeBreakdown} subtitle="Today" />
        <BarChartCard
          title="Last 7 Days — Gross Revenue"
          data={weeklyTrend.map((day) => ({
            label: WEEKDAY[new Date(`${day.date}T00:00:00`).getDay()]!,
            value: day.grossRevenue,
          }))}
          valueFormatter={formatMoney}
          emptyMessage="No sales recorded in the last 7 days."
        />
      </div>

      <TopDishesList dishes={topDishes} categories={topCategories} />
    </main>
  );
}
