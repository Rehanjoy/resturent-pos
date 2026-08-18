"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { areasApi, tablesApi } from "@/lib/tables/api";
import type {
  Area,
  RestaurantTable,
  TableStatus,
  TableStatusChangedEvent,
} from "@/lib/tables/types";
import { ordersApi } from "@/lib/orders/api";
import type { Order, OrderStatus, OrderUpdatedEvent } from "@/lib/orders/types";
import { connectSocket } from "@/lib/socket";
import { PageHeader } from "@/components/ui/page-header";
import { AreaTabs } from "./area-tabs";
import { TableCard } from "./table-card";
import { TableStatChips } from "./table-stat-chips";
import { AreaFormModal } from "./area-form-modal";
import { TableFormModal } from "./table-form-modal";

const VIEW_ROLES = new Set(["owner", "manager", "cashier", "server"]);
const MANAGE_ROLES = new Set(["owner", "manager"]);
const STATUS_CHANGE_ROLES = new Set(["owner", "manager", "server"]);
// Mirrors the Billing gate in `order-workspace.tsx` — same three roles can
// jump straight from a served table's card to `/admin/billing/[orderId]`.
const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);

// A table's own `status` field doesn't carry its order's item count/amount
// — that lives on the `Order` document. Rather than add a new backend
// endpoint (out of scope for this frontend-only pass), this screen reuses
// the existing `GET /api/orders` list endpoint with a bounded time window:
// any order still holding a table (draft/sent/in_kitchen/ready/served) was
// necessarily created recently, so a 24h lookback is enough to catch every
// live order — including one that started just before midnight — without
// pulling the restaurant's entire order history on every Tables screen
// load (that endpoint has no built-in pagination).
const ACTIVE_ORDER_LOOKBACK_HOURS = 24;
const LIVE_ORDER_STATUSES: OrderStatus[] = ["draft", "sent", "in_kitchen", "ready", "served"];

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function TablesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);
  const canChangeStatus = !!user && STATUS_CHANGE_ROLES.has(user.role);

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [areaModal, setAreaModal] = useState<{ mode: "add" | "edit"; area: Area | null } | null>(
    null,
  );
  const [tableModal, setTableModal] = useState<
    { mode: "add" | "edit"; table: RestaurantTable | null } | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: () => areasApi.list(),
    enabled: canView,
  });

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: () => tablesApi.list(),
    enabled: canView,
  });

  const activeOrdersQuery = useQuery({
    queryKey: ["active-orders-for-tables"],
    queryFn: () =>
      ordersApi
        .list({ from: new Date(Date.now() - ACTIVE_ORDER_LOOKBACK_HOURS * 3_600_000).toISOString() })
        .then((result) => result.orders),
    enabled: canView,
  });

  const areas = areasQuery.data?.areas ?? [];
  const tables = tablesQuery.data?.tables;
  const areaNameById = useMemo(
    () => new Map((areasQuery.data?.areas ?? []).map((area) => [area.id, area.name])),
    [areasQuery.data],
  );

  const orderByTableId = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of activeOrdersQuery.data ?? []) {
      if (LIVE_ORDER_STATUSES.includes(order.status)) {
        map.set(order.tableId, order);
      }
    }
    return map;
  }, [activeOrdersQuery.data]);

  const visibleTables = useMemo(() => {
    const all = tables ?? [];
    return activeAreaId ? all.filter((table) => table.areaId === activeAreaId) : all;
  }, [tables, activeAreaId]);

  // Real-time table-status sync (PRD §3.5) — every connected terminal
  // patches its local cache in place when any terminal changes a table's
  // status, no refetch needed. Also listens for `order:updated` so the
  // item-count/amount shown on an occupied table's card stays live too
  // (e.g. another terminal adds an item to the same table's order) —
  // additive to the pre-existing table-status subscription, not a
  // replacement for it.
  useEffect(() => {
    if (!canView) return;
    const socket = connectSocket();

    const handleStatusChanged = (event: TableStatusChangedEvent) => {
      queryClient.setQueryData<{ tables: RestaurantTable[] } | undefined>(
        ["tables"],
        (current) => {
          if (!current) return current;
          return {
            tables: current.tables.map((table) =>
              table.id === event.table.id ? event.table : table,
            ),
          };
        },
      );
    };

    const handleOrderUpdated = (event: OrderUpdatedEvent) => {
      queryClient.setQueryData<Order[] | undefined>(["active-orders-for-tables"], (current) => {
        if (!current) return current;
        const exists = current.some((order) => order.id === event.order.id);
        return exists
          ? current.map((order) => (order.id === event.order.id ? event.order : order))
          : [...current, event.order];
      });
    };

    socket.on("table:status-changed", handleStatusChanged);
    socket.on("order:updated", handleOrderUpdated);
    return () => {
      socket.off("table:status-changed", handleStatusChanged);
      socket.off("order:updated", handleOrderUpdated);
    };
  }, [canView, queryClient]);

  const createAreaMutation = useMutation({
    mutationFn: areasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setAreaModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the area.")),
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; displayOrder?: number } }) =>
      areasApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setAreaModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the area.")),
  });

  const deleteAreaMutation = useMutation({
    mutationFn: areasApi.remove,
    onSuccess: (_, areaId) => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      if (activeAreaId === areaId) setActiveAreaId(null);
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the area."));
    },
  });

  const createTableMutation = useMutation({
    mutationFn: tablesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setTableModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the table.")),
  });

  const updateTableMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{
        areaId: string;
        name: string;
        seatingCapacity: number;
        shape: RestaurantTable["shape"];
      }>;
    }) => tablesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setTableModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the table.")),
  });

  const deleteTableMutation = useMutation({
    mutationFn: tablesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the table."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      tablesApi.updateStatus(id, status),
    onSuccess: (result) => {
      queryClient.setQueryData<{ tables: RestaurantTable[] } | undefined>(
        ["tables"],
        (current) => {
          if (!current) return current;
          return {
            tables: current.tables.map((table) =>
              table.id === result.table.id ? result.table : table,
            ),
          };
        },
      );
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not change the table's status."));
    },
  });

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-text-muted">
          You don&apos;t have access to Tables &amp; Areas.
        </p>
      </main>
    );
  }

  const isLoading = areasQuery.isLoading || tablesQuery.isLoading;
  const isError = areasQuery.isError || tablesQuery.isError;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Tables"
        subtitle="Live floor status — tap a table to open its order."
        action={
          canManage && (
            <button
              type="button"
              onClick={() => setTableModal({ mode: "add", table: null })}
              disabled={areas.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
              title={areas.length === 0 ? "Add an area first" : undefined}
            >
              + Add Table
            </button>
          )
        }
      />

      {!isLoading && !isError && tables && tables.length > 0 && <TableStatChips tables={tables} />}

      <AreaTabs
        areas={areas}
        activeAreaId={activeAreaId}
        onSelect={setActiveAreaId}
        canManage={canManage}
        onAddArea={() => {
          setFormError(null);
          setAreaModal({ mode: "add", area: null });
        }}
        onEditArea={(area) => {
          setFormError(null);
          setAreaModal({ mode: "edit", area });
        }}
        onDeleteArea={(area) => {
          if (window.confirm(`Delete area "${area.name}"?`)) {
            deleteAreaMutation.mutate(area.id);
          }
        }}
      />

      {isLoading && <p className="text-small text-text-muted">Loading tables…</p>}

      {isError && (
        <p className="text-small text-error">
          Could not load tables — check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && areas.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            No areas yet. Add your first area to start setting up tables.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setAreaModal({ mode: "add", area: null })}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-button text-white"
            >
              Add Area
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && areas.length > 0 && visibleTables.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            No tables yet. Add your first table to start taking orders.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setTableModal({ mode: "add", table: null })}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-button text-white"
            >
              Add Table
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && visibleTables.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visibleTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              areaName={areaNameById.get(table.areaId)}
              order={orderByTableId.get(table.id)}
              canManage={canManage}
              canChangeStatus={canChangeStatus}
              canBill={!!user && BILLING_ROLES.has(user.role)}
              onOpen={(target) => {
                if (target.status === "free") {
                  router.push(`/admin/orders/new?tableId=${target.id}`);
                } else if (target.status === "occupied") {
                  router.push(`/admin/orders/active?tableId=${target.id}`);
                }
              }}
              onBill={(order) => router.push(`/admin/billing/${order.id}`)}
              onStatusChange={(target, status) =>
                statusMutation.mutate({ id: target.id, status })
              }
              onEdit={(target) => {
                setFormError(null);
                setTableModal({ mode: "edit", table: target });
              }}
              onDelete={(target) => {
                if (window.confirm(`Delete table "${target.name}"?`)) {
                  deleteTableMutation.mutate(target.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {areaModal && (
        <AreaFormModal
          area={areaModal.area}
          onClose={() => {
            setAreaModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (areaModal.mode === "add") {
              createAreaMutation.mutate(input);
            } else if (areaModal.area) {
              updateAreaMutation.mutate({ id: areaModal.area.id, input });
            }
          }}
          isSubmitting={createAreaMutation.isPending || updateAreaMutation.isPending}
          errorMessage={formError}
        />
      )}

      {tableModal && (
        <TableFormModal
          table={tableModal.table}
          areas={areas}
          defaultAreaId={activeAreaId}
          onClose={() => {
            setTableModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (tableModal.mode === "add") {
              createTableMutation.mutate(input);
            } else if (tableModal.table) {
              updateTableMutation.mutate({ id: tableModal.table.id, input });
            }
          }}
          isSubmitting={createTableMutation.isPending || updateTableMutation.isPending}
          errorMessage={formError}
        />
      )}
    </main>
  );
}
