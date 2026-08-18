"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { dashboardApi } from "@/lib/dashboard/api";
import { formatMoney } from "@/lib/format";
import { StatCard } from "./stat-card";
import { PaymentModeBar } from "./payment-mode-bar";
import { LiveOpsTiles } from "./live-ops-tiles";
import { TopDishesList } from "./top-dishes-list";
import { WeeklyTrendChart } from "./weekly-trend-chart";

// PRD §2 Dashboard column: Owner/Manager "Full", Cashier "View" — every
// other role has no access at all (matches the nav rail's role filter and
// the backend's `authorize()` guard on GET /api/dashboard/summary).
const DASHBOARD_ROLES = new Set(["owner", "manager", "cashier"]);

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
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-small text-text-muted">Loading dashboard…</p>
      </main>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-small text-error">
          Could not load the dashboard — check your connection and try again.
        </p>
      </main>
    );
  }

  const { salesSummary, paymentModeBreakdown, liveOps, topDishes, topCategories, weeklyTrend } =
    summaryQuery.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <h1 className="font-heading text-h1 font-semibold text-text">Dashboard</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <StatCard label="Gross Sales Today" value={formatMoney(salesSummary.grossRevenue)} />
        <StatCard label="Net Sales Today" value={formatMoney(salesSummary.netRevenue)} />
        <StatCard label="Tax Collected" value={formatMoney(salesSummary.totalTax)} />
        <StatCard
          label="Discounts Given"
          value={formatMoney(salesSummary.totalDiscounts)}
          tone={salesSummary.totalDiscounts > 0 ? "error" : "default"}
        />
      </div>

      <LiveOpsTiles liveOps={liveOps} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentModeBar breakdown={paymentModeBreakdown} />
        <WeeklyTrendChart days={weeklyTrend} />
      </div>

      <TopDishesList dishes={topDishes} categories={topCategories} />
    </main>
  );
}
