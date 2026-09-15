"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BoxIcon, DashboardIcon, StaffIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth/auth-context";
import { dashboardApi } from "@/lib/dashboard/api";
import { inventoryItemsApi } from "@/lib/inventory/api";
import { reportsApi } from "@/lib/reports/api";
import { defaultModulesForRole } from "@/lib/staff/types";
import { DashboardErrorState, DashboardLoadingState } from "./analytics-charts";
import { EarningsPanel } from "./earnings-panel";
import { InventoryPanel } from "./inventory-panel";
import { StaffPanel } from "./staff-panel";

const DASHBOARD_ROLES = new Set(["owner", "manager", "cashier"]);
type DashboardTab = "earnings" | "staff" | "inventory";

const TABS = [
  { id: "earnings" as const, label: "Earnings", description: "Sales, payments and demand", icon: DashboardIcon },
  { id: "staff" as const, label: "Staff", description: "Output and service speed", icon: StaffIcon },
  { id: "inventory" as const, label: "Inventory", description: "Stock health and value", icon: BoxIcon },
];

export function DashboardScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("earnings");
  const canViewDashboard = !!user && DASHBOARD_ROLES.has(user.role);
  const visibleModules = user
    ? new Set(user.visibleModules?.length ? user.visibleModules : defaultModulesForRole(user.role))
    : new Set<string>();
  const canViewStaffDetail = !!user
    && (user.role === "owner" || user.role === "manager")
    && visibleModules.has("staff");
  const canViewInventoryDetail = !!user
    && (user.role === "owner" || user.role === "manager")
    && visibleModules.has("inventory");

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardApi.getSummary().then((result) => result.summary),
    enabled: canViewDashboard && activeTab === "earnings",
    refetchInterval: 30_000,
    retry: false,
  });

  const staffQuery = useQuery({
    queryKey: ["dashboard-staff-performance", "7d"],
    queryFn: () => reportsApi.getStaffPerformanceReport({ range: "7d" }).then((result) => result.report),
    enabled: canViewDashboard && canViewStaffDetail && activeTab === "staff",
    staleTime: 60_000,
    retry: false,
  });

  const inventoryQuery = useQuery({
    queryKey: ["dashboard-inventory-items"],
    queryFn: () => inventoryItemsApi.list().then((result) => result.inventoryItems),
    enabled: canViewDashboard && canViewInventoryDetail && activeTab === "inventory",
    staleTime: 30_000,
    retry: false,
  });

  if (!user) return null;

  if (!canViewDashboard) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to the dashboard.</p>
      </main>
    );
  }

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader title="Dashboard" subtitle={`${todayLabel} · Live restaurant intelligence`} />

      <div role="tablist" aria-label="Dashboard analysis" className="glass-panel grid gap-2 rounded-2xl p-2 sm:grid-cols-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`dashboard-tab-${tab.id}`}
              aria-controls={`dashboard-panel-${tab.id}`}
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${selected ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_10px_24px_rgba(229,62,21,.22)]" : "text-text hover:bg-white/65"}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-body font-semibold">{tab.label}</span>
                <span className={`hidden truncate text-[11px] lg:block ${selected ? "text-white/80" : "text-text-muted"}`}>{tab.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "earnings" ? (
        summaryQuery.isLoading ? <DashboardLoadingState label="Loading earnings analysis" />
          : summaryQuery.isError || !summaryQuery.data ? <DashboardErrorState message="Could not load earnings — check your connection and try again." onRetry={() => void summaryQuery.refetch()} />
            : <EarningsPanel summary={summaryQuery.data} canViewInventory={canViewInventoryDetail} />
      ) : null}

      {activeTab === "staff" ? (
        !canViewStaffDetail ? <RestrictedPanel id="staff" title="Staff analytics are restricted" message="An Owner or Manager with the Staff workspace enabled can view individual performance." />
          : staffQuery.isLoading ? <DashboardLoadingState label="Loading staff analysis" />
            : staffQuery.isError || !staffQuery.data ? <DashboardErrorState message="Could not load staff performance — check your connection and try again." onRetry={() => void staffQuery.refetch()} />
              : <StaffPanel report={staffQuery.data} />
      ) : null}

      {activeTab === "inventory" ? (
        !canViewInventoryDetail ? <RestrictedPanel id="inventory" title="Inventory analytics are restricted" message="An Owner or Manager with the Inventory workspace enabled can view stock value and ingredient health." />
          : inventoryQuery.isLoading ? <DashboardLoadingState label="Loading inventory analysis" />
            : inventoryQuery.isError || !inventoryQuery.data ? <DashboardErrorState message="Could not load inventory analysis — check your connection and try again." onRetry={() => void inventoryQuery.refetch()} />
              : <InventoryPanel items={inventoryQuery.data} />
      ) : null}
    </main>
  );
}

function RestrictedPanel({ id, title, message }: {
  id: Exclude<DashboardTab, "earnings">;
  title: string;
  message: string;
}) {
  return (
    <section role="tabpanel" id={`dashboard-panel-${id}`} aria-labelledby={`dashboard-tab-${id}`} className="rounded-2xl border border-border bg-surface px-6 py-14 text-center shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-small text-text-muted">{message}</p>
    </section>
  );
}
