"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { reportsApi } from "@/lib/reports/api";
import type { ReportRangeParams } from "@/lib/reports/types";
import { PaymentModeBar } from "@/components/dashboard/payment-mode-bar";
import { RangeFilter } from "./range-filter";
import { ExportButton } from "./export-button";
import { SalesOverviewTab } from "./sales-overview-tab";
import { RevenueByCategoryTab } from "./revenue-by-category-tab";
import { TopDishesTab } from "./top-dishes-tab";
import { StaffPerformanceTab } from "./staff-performance-tab";

// PRD §2 Reports column: Owner/Manager "Full", Cashier "sales only" —
// every tab except Staff Performance (see `report.routes.ts` for the
// matching server-side carve-out, independently enforced, not just hidden
// here).
const REPORTS_ROLES = new Set(["owner", "manager", "cashier"]);
const STAFF_PERFORMANCE_ROLES = new Set(["owner", "manager"]);

type TabKey = "overview" | "category" | "payment-mode" | "top-dishes" | "staff";

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Sales Overview" },
  { key: "category", label: "Revenue by Category" },
  { key: "payment-mode", label: "Revenue by Payment Mode" },
  { key: "top-dishes", label: "Top Dishes" },
  { key: "staff", label: "Staff Performance" },
];

export function ReportsScreen() {
  const { user } = useAuth();
  const canView = !!user && REPORTS_ROLES.has(user.role);
  const canViewStaffPerformance = !!user && STAFF_PERFORMANCE_ROLES.has(user.role);

  const [params, setParams] = useState<ReportRangeParams>({ range: "today" });
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const isCustomIncomplete = params.range === "custom" && (!params.from || !params.to);

  const salesQuery = useQuery({
    queryKey: ["reports-sales", params],
    queryFn: () => reportsApi.getSalesReport(params).then((r) => r.report),
    enabled: canView && !isCustomIncomplete && ["overview", "category", "payment-mode"].includes(activeTab),
  });

  const topDishesQuery = useQuery({
    queryKey: ["reports-top-dishes", params],
    queryFn: () => reportsApi.getTopDishesReport(params).then((r) => r.report),
    enabled: canView && !isCustomIncomplete && activeTab === "top-dishes",
  });

  const staffQuery = useQuery({
    queryKey: ["reports-staff-performance", params],
    queryFn: () => reportsApi.getStaffPerformanceReport(params).then((r) => r.report),
    enabled: canViewStaffPerformance && !isCustomIncomplete && activeTab === "staff",
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to reports.</p>
      </main>
    );
  }

  const visibleTabs = ALL_TABS.filter((tab) => tab.key !== "staff" || canViewStaffPerformance);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <h1 className="font-heading text-h1 font-semibold text-text">Reports</h1>

      <RangeFilter params={params} onChange={setParams} />

      <div className="flex items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-t-md px-3 py-2 text-small font-medium ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {(activeTab === "overview" || activeTab === "category" || activeTab === "payment-mode") && (
          <ExportButton reportType="sales" params={params} />
        )}
        {activeTab === "top-dishes" && <ExportButton reportType="top-dishes" params={params} />}
      </div>

      {isCustomIncomplete ? (
        <p className="text-small text-text-muted">Pick both a from and to date for a custom range.</p>
      ) : (
        <>
          {activeTab === "overview" && <ReportTabBody query={salesQuery} render={(r) => <SalesOverviewTab report={r} />} />}
          {activeTab === "category" && (
            <ReportTabBody query={salesQuery} render={(r) => <RevenueByCategoryTab categories={r.revenueByCategory} />} />
          )}
          {activeTab === "payment-mode" && (
            <ReportTabBody query={salesQuery} render={(r) => <PaymentModeBar breakdown={r.revenueByPaymentMode} />} />
          )}
          {activeTab === "top-dishes" && (
            <ReportTabBody query={topDishesQuery} render={(r) => <TopDishesTab report={r} />} />
          )}
          {activeTab === "staff" && canViewStaffPerformance && (
            <ReportTabBody query={staffQuery} render={(r) => <StaffPerformanceTab report={r} />} />
          )}
        </>
      )}
    </main>
  );
}

function ReportTabBody<T>({
  query,
  render,
}: {
  query: { isLoading: boolean; isError: boolean; data: T | undefined };
  render: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) {
    return <p className="text-small text-text-muted">Loading report…</p>;
  }
  if (query.isError || !query.data) {
    return <p className="text-small text-error">Could not load this report — check your connection and try again.</p>;
  }
  return <>{render(query.data)}</>;
}
