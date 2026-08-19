"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/orders/api";
import { tablesApi } from "@/lib/tables/api";
import type { Order, OrderCreatedEvent, OrderStatus, OrderUpdatedEvent } from "@/lib/orders/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { orderStatusTone, type OrderStatusTone } from "./order-status-stepper";
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

// Colors are derived from `orderStatusTone` (also used by
// `order-status-stepper.tsx`) rather than hand-picked per status here, so
// this compact row dot can never drift out of sync with what the same
// status looks like on the full stepper — e.g. `sent`/`in_kitchen`/`ready`/
// `served` all render as the stepper's "current step" accent color (they're
// all "the order is actively moving, not finished yet"), and `billed`/
// `closed` both render as the stepper's "complete" success color.
const TONE_DOT: Record<OrderStatusTone, string> = {
  muted: "bg-text-muted",
  current: "bg-accent",
  success: "bg-success",
  error: "bg-error",
};

const TONE_TEXT: Record<OrderStatusTone, string> = {
  muted: "text-text-muted",
  current: "text-accent",
  success: "text-success",
  error: "text-error",
};

// Terminal/idle states a table naturally accumulates over a day — grouped
// under the "Closed/Voided" filter pill so "Active" defaults to what the
// floor actually needs to act on.
const CLOSED_STATUSES = new Set<OrderStatus>(["closed", "void"]);

/**
 * A table's order is auto-created (empty, `status: "draft"`) the instant
 * staff open it from the Table Grid — see `order-workspace.tsx`'s
 * `openOrderMutation`, which fires unconditionally on mount so the New
 * Order screen is always ready to add to. That means a table someone
 * merely glanced at leaves behind a permanent zero-item draft with no
 * real activity. This list is for staff to find and act on actual orders,
 * so a draft with nothing in it yet is filtered out everywhere below,
 * regardless of which status pill is selected — it isn't a fourth
 * category, it's just noise.
 */
function isMeaningfulOrder(order: Order): boolean {
  return order.items.length > 0;
}

type FilterKey = "active" | "closed" | "all";

const FILTER_LABEL: Record<FilterKey, string> = {
  active: "Active",
  closed: "Closed / Voided",
  all: "All",
};

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
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("active");

  const ordersQuery = useQuery({
    queryKey: ["orders-overview", "today"],
    // Bounded to today rather than all-time history — keeps this screen
    // fast and relevant to the floor's current shift. A fuller date-range
    // history view belongs on the Reports screen, not here.
    queryFn: () => ordersApi.list({ from: startOfTodayIso() }).then((result) => result.orders),
    // Live updates arrive over the socket (below) the moment they happen —
    // this poll is only a safety net for an event missed during a dropped
    // connection/reconnect window, so it can be long-interval rather than
    // the primary update path.
    refetchInterval: 60_000,
  });

  const patchOrder = (incoming: Order) => {
    queryClient.setQueryData<Order[] | undefined>(["orders-overview", "today"], (current) => {
      if (!current) return current;
      const exists = current.some((order) => order.id === incoming.id);
      return exists
        ? current.map((order) => (order.id === incoming.id ? incoming : order))
        : [...current, incoming];
    });
  };

  useSocketEvent<OrderCreatedEvent>("order:created", (event) => patchOrder(event.order));
  useSocketEvent<OrderUpdatedEvent>("order:updated", (event) => patchOrder(event.order));

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

  // Real orders only (see `isMeaningfulOrder`), split once by status so
  // every pill's count can be shown without re-filtering per render.
  const meaningfulOrders = useMemo(
    () => (ordersQuery.data ?? []).filter(isMeaningfulOrder),
    [ordersQuery.data],
  );

  const counts = useMemo(
    () => ({
      active: meaningfulOrders.filter((order) => !CLOSED_STATUSES.has(order.status)).length,
      closed: meaningfulOrders.filter((order) => CLOSED_STATUSES.has(order.status)).length,
      all: meaningfulOrders.length,
    }),
    [meaningfulOrders],
  );

  const groups = useMemo(() => {
    const filtered = meaningfulOrders.filter((order) => {
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
  }, [meaningfulOrders, tableById, filter]);

  const isLoading = ordersQuery.isLoading || tablesQuery.isLoading;
  const isError = ordersQuery.isError || tablesQuery.isError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {(Object.keys(FILTER_LABEL) as FilterKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-small font-medium transition-colors ${
              filter === key ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {FILTER_LABEL[key]}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                filter === key ? "bg-primary/15 text-primary" : "bg-border text-text-muted"
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading orders…</p>}

      {isError && (
        <p className="text-small text-error">Could not load orders — check your connection and try again.</p>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-small text-text-muted">
            {filter === "active"
              ? "No active orders right now — new ones will show up here as soon as items are added."
              : filter === "closed"
                ? "No closed or voided orders yet today."
                : "No orders yet today."}
          </p>
        </div>
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
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[orderStatusTone(order.status)]}`}
                        />
                        <span className={TONE_TEXT[orderStatusTone(order.status)]}>
                          {STATUS_LABEL[order.status]}
                        </span>
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
