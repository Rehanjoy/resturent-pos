"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ordersApi } from "@/lib/orders/api";
import { tablesApi } from "@/lib/tables/api";
import type { Order, OrderStatus } from "@/lib/orders/types";
import { formatMoney } from "@/lib/format";
import { ReceiptIcon } from "@/components/icons";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  sent: "Sent to Kitchen",
  in_kitchen: "In Kitchen",
  ready: "Ready to Serve",
  served: "Served",
  billed: "Billed",
  closed: "Closed",
  void: "Voided",
};

const STATUS_DOT: Record<OrderStatus, string> = {
  draft: "bg-text-muted",
  sent: "bg-info",
  in_kitchen: "bg-warning",
  ready: "bg-success",
  served: "bg-primary",
  billed: "bg-secondary",
  closed: "bg-text-muted",
  void: "bg-error",
};

const STATUS_TEXT: Record<OrderStatus, string> = {
  draft: "text-text-muted",
  sent: "text-info",
  in_kitchen: "text-warning",
  ready: "text-success",
  served: "text-primary",
  billed: "text-secondary",
  closed: "text-text-muted",
  void: "text-error",
};

// Terminal/idle states a table naturally accumulates over a day — grouped
// under the "Closed/Voided" filter pill so "Active" defaults to what the
// floor actually needs to act on.
const CLOSED_STATUSES = new Set<OrderStatus>(["closed", "void"]);

type FilterKey = "active" | "closed" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "closed", label: "Closed / Voided" },
  { key: "all", label: "All" },
];

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Shown at `/admin/orders/active` when no `?tableId=` is present — i.e.
 * whenever "Orders" is opened straight from the sidebar rather than via a
 * specific table. Previously this dead-ended with "no table selected."
 * Lists every order created today, grouped by table, so staff can see and
 * jump into any in-progress or recently-closed order without having to
 * remember which table it was on.
 */
export function OrdersOverview() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("active");

  const ordersQuery = useQuery({
    queryKey: ["orders-overview", "today"],
    // Bounded to today rather than all-time history — keeps this screen
    // fast and relevant to the floor's current shift. A fuller date-range
    // history view belongs on the Reports screen, not here.
    queryFn: () => ordersApi.list({ from: startOfTodayIso() }).then((result) => result.orders),
    refetchInterval: 30_000,
  });

  // Cache shape must match every other consumer of this query key exactly
  // (`tables-screen.tsx`, `order-workspace.tsx`, `kds-board.tsx`,
  // `reservations-screen.tsx` all cache the full `{ tables }` response
  // object here) — React Query's cache is shared globally by key, so a
  // queryFn that unwrapped to a bare array here would silently clobber
  // what every other screen reading `["tables"]` expects to find.
  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: () => tablesApi.list(),
  });

  const tableById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const table of tablesQuery.data?.tables ?? []) map.set(table.id, { name: table.name });
    return map;
  }, [tablesQuery.data]);

  const groups = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const filtered = orders.filter((order) => {
      if (filter === "active") return !CLOSED_STATUSES.has(order.status);
      if (filter === "closed") return CLOSED_STATUSES.has(order.status);
      return true;
    });

    const byTable = new Map<string, Order[]>();
    for (const order of filtered) {
      const list = byTable.get(order.tableId) ?? [];
      list.push(order);
      byTable.set(order.tableId, list);
    }
    for (const list of byTable.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return Array.from(byTable.entries())
      .map(([tableId, orders]) => ({
        tableId,
        tableName: tableById.get(tableId)?.name ?? "Unknown table",
        orders,
      }))
      .sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));
  }, [ordersQuery.data, tableById, filter]);

  const isLoading = ordersQuery.isLoading || tablesQuery.isLoading;
  const isError = ordersQuery.isError || tablesQuery.isError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-lg px-3 py-1.5 text-small font-medium ${
              filter === option.key ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading orders…</p>}

      {isError && (
        <p className="text-small text-error">Could not load orders — check your connection and try again.</p>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <p className="text-small text-text-muted">
          {filter === "active" ? "No active orders right now." : "No orders match this filter today."}
        </p>
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.tableId}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <h3 className="font-heading text-h4 font-semibold text-text">{group.tableName}</h3>
              <div className="flex flex-col gap-2">
                {group.orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => router.push(`/admin/orders/active?tableId=${order.tableId}`)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2 text-small font-medium">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[order.status]}`} />
                        <span className={STATUS_TEXT[order.status]}>{STATUS_LABEL[order.status]}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-small text-text-muted">
                        <ReceiptIcon className="h-3.5 w-3.5" />
                        {order.items.length} item{order.items.length === 1 ? "" : "s"} · {relativeTime(order.createdAt)}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-text">
                      {formatMoney(order.subtotal)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
