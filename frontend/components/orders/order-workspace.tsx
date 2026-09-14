"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { categoriesApi, menuItemsApi } from "@/lib/menu/api";
import type { MenuItem } from "@/lib/menu/types";
import { tablesApi } from "@/lib/tables/api";
import { ordersApi } from "@/lib/orders/api";
import type { OrderItem, OrderStatus, OrderUpdatedEvent } from "@/lib/orders/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SearchIcon } from "@/components/icons";
import { CategoryTabs } from "./category-tabs";
import { OrderItemTile } from "./order-item-tile";
import { ItemCustomizationModal, type ItemCustomization } from "./item-customization-modal";
import { CartRail } from "./cart-rail";
import { VoidOrderModal } from "./void-order-modal";
import { OrderStatusStepper } from "./order-status-stepper";

const BUILD_ROLES = new Set(["owner", "manager", "cashier", "server"]);
const VOID_ROLES = new Set(["owner", "manager"]);
const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);
const NON_VOIDABLE: OrderStatus[] = ["billed", "closed", "void"];

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Shared orchestrator behind both `/admin/orders/new` and
 * `/admin/orders/active` — the two screens differ only in what happens
 * right after the table's order is resolved and after a "send to kitchen"
 * succeeds (see `mode` below); everything else (menu browsing,
 * customization, cart, KOT history, serve, void) is identical.
 */
export function OrderWorkspace({ tableId, mode, initialOrderId }: { tableId: string; mode: "new" | "active"; initialOrderId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canBuild = !!user && BUILD_ROLES.has(user.role);
  const canVoid = !!user && VOID_ROLES.has(user.role);
  const canBill = !!user && BILLING_ROLES.has(user.role);

  const [orderId, setOrderId] = useState<string | null>(initialOrderId ?? null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: () => tablesApi.list() });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const menuItemsQuery = useQuery({ queryKey: ["menuItems"], queryFn: () => menuItemsApi.list() });

  const table = tablesQuery.data?.tables.find((candidate) => candidate.id === tableId);
  const categories = categoriesQuery.data?.categories ?? [];

  // Both filters run client-side — the full menu is already loaded in one
  // shot by `menuItemsQuery` (no per-keystroke API calls needed, and no
  // backend search endpoint required for this).
  const visibleItems = useMemo(() => {
    const items = menuItemsQuery.data?.menuItems ?? [];
    const byCategory = activeCategoryId
      ? items.filter((item) => item.categoryId === activeCategoryId)
      : items;
    const term = searchTerm.trim().toLowerCase();
    return term ? byCategory.filter((item) => item.name.toLowerCase().includes(term)) : byCategory;
  }, [menuItemsQuery.data, activeCategoryId, searchTerm]);

  // Opening an order is idempotent on the backend (returns the table's
  // existing live order if there is one), so it's safe to fire this
  // unconditionally on mount without a "did we already call this" guard —
  // it also covers navigating back to an in-progress draft.
  const openOrderMutation = useMutation({
    mutationFn: () => ordersApi.create(tableId),
    onSuccess: (result) => {
      setOrderId(result.order.id);
      queryClient.setQueryData(["order", result.order.id], result.order);
      setOpenError(null);
    },
    onError: (error) => setOpenError(errorMessageOf(error, "Could not open this table's order.")),
  });

  useEffect(() => {
    if (!initialOrderId) openOrderMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, initialOrderId]);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(orderId as string).then((result) => result.order),
    enabled: !!orderId,
  });

  const order = orderQuery.data;
  const canEditCurrentOrder = canBuild && order?.source !== "qr";

  // The New Order screen assumes a fresh draft. If the table already has
  // an order that's progressed past draft (e.g. reached via a stale link
  // or browser back button), hand off to the Active Order screen instead
  // of showing an empty cart on top of an order the kitchen is already
  // working.
  useEffect(() => {
    if (mode === "new" && order && order.status !== "draft") {
      router.replace(`/admin/orders/active?tableId=${tableId}`);
    }
  }, [mode, order, router, tableId]);

  useSocketEvent<OrderUpdatedEvent>(
    "order:updated",
    (event) => {
      if (event.order.id !== orderId) return;
      queryClient.setQueryData(["order", orderId], event.order);
    },
    { enabled: !!orderId },
  );

  const addItemMutation = useMutation({
    mutationFn: (customization: ItemCustomization & { menuItemId: string }) =>
      ordersApi.editItems(orderId as string, { addItems: [customization] }),
    onSuccess: (result) => {
      queryClient.setQueryData(["order", orderId], result.order);
      setCustomizeItem(null);
      setCartError(null);
    },
    onError: (error) => setCartError(errorMessageOf(error, "Could not add this item.")),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      ordersApi.editItems(orderId as string, { updateItems: [{ itemId, qty }] }),
    onSuccess: (result) => queryClient.setQueryData(["order", orderId], result.order),
    onError: (error) => window.alert(errorMessageOf(error, "Could not update this item.")),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      ordersApi.editItems(orderId as string, { removeItemIds: [itemId] }),
    onSuccess: (result) => queryClient.setQueryData(["order", orderId], result.order),
    onError: (error) => window.alert(errorMessageOf(error, "Could not remove this item.")),
  });

  const sendToKitchenMutation = useMutation({
    mutationFn: () => ordersApi.sendToKitchen(orderId as string),
    onSuccess: (result) => {
      queryClient.setQueryData(["order", orderId], result.order);
      setCartError(null);
      if (mode === "new") {
        router.push(`/admin/orders/active?tableId=${tableId}`);
      }
    },
    onError: (error) =>
      setCartError(
        errorMessageOf(error, "Order not sent to kitchen — check your connection and try again."),
      ),
  });

  const serveMutation = useMutation({
    mutationFn: () => ordersApi.serve(orderId as string),
    onSuccess: (result) => queryClient.setQueryData(["order", orderId], result.order),
    onError: (error) => window.alert(errorMessageOf(error, "Could not serve these items.")),
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.voidOrder(orderId as string, reason),
    onSuccess: () => router.push("/admin/tables"),
    onError: (error) => setVoidError(errorMessageOf(error, "Could not void this order.")),
  });

  if (!user) return null;

  const isLoading =
    openOrderMutation.isPending ||
    orderQuery.isLoading ||
    categoriesQuery.isLoading ||
    menuItemsQuery.isLoading;

  const isError = openError || orderQuery.isError || categoriesQuery.isError || menuItemsQuery.isError;

  const pendingItems: OrderItem[] = order?.items.filter((item) => item.itemStatus === "pending") ?? [];
  const sentItems: OrderItem[] = order?.items.filter((item) => item.itemStatus !== "pending") ?? [];
  const readyCount = order?.items.filter((item) => item.itemStatus === "ready").length ?? 0;
  const isVoidable = !!order && !NON_VOIDABLE.includes(order.status);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 pb-24 sm:px-6 lg:pb-6">
      <PageHeader
        title={table ? table.name : "Order"}
        action={
          <div className="flex items-center gap-3">
            {canBuild && readyCount > 0 && (
              <button
                type="button"
                onClick={() => serveMutation.mutate()}
                disabled={serveMutation.isPending}
                className="rounded-lg border border-success px-4 py-2 text-button text-success disabled:opacity-60"
              >
                {serveMutation.isPending ? "Serving…" : `Serve Ready Items (${readyCount})`}
              </button>
            )}
            {canBill && order?.status === "served" && (
              <button
                type="button"
                onClick={() => router.push(`/admin/billing/${order.id}`)}
                className="rounded-lg bg-accent px-4 py-2 text-button text-white"
              >
                Settle Bill
              </button>
            )}
            {canVoid && isVoidable && (
              <button
                type="button"
                onClick={() => {
                  setVoidError(null);
                  setVoidModalOpen(true);
                }}
                className="rounded-lg border border-error px-4 py-2 text-button text-error"
              >
                Void Order
              </button>
            )}
          </div>
        }
      />

      {isLoading && <p className="text-small text-text-muted">Loading order…</p>}

      {isError && (
        <p className="text-small text-error">
          {openError ?? "Could not load this order — check your connection and try again."}
        </p>
      )}

      {!isLoading && !isError && order && (
        <OrderStatusStepper
          status={order.status}
          voidReason={order.voidReason}
          className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm"
        />
      )}

      {!isLoading && !isError && order?.source === "qr" && (
        <div className="grid gap-3 rounded-2xl border border-info/20 bg-info/5 px-4 py-3 text-sm text-text sm:grid-cols-2">
          <div>
            <p className="font-semibold">Guest QR order</p>
            <p className="mt-1 text-text-muted">
              Guests can add another food batch and cancel selectable quantities. Kitchen progress,
              billing and counter payment stay connected to this order.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-surface/80 p-3">
            <div>
              <dt className="text-xs text-text-muted">Assigned waiter</dt>
              <dd className="font-medium">{order.assignedWaiter?.name ?? "Awaiting assignment"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Reserved seats</dt>
              <dd className="font-medium">
                {order.seats?.length
                  ? order.seats.map((seat) => `Chair ${seat.chairNumber}`).join(", ")
                  : "Whole table"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!isLoading && !isError && order && (order.cancellations?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-error/20 bg-error/5 p-4" aria-labelledby="cancelled-items-heading">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="cancelled-items-heading" className="font-heading text-h4 font-semibold text-text">
                Cancelled items
              </h2>
              <p className="text-small text-text-muted">
                Original quantities stay in the order audit. Charge and tax are calculated per cancellation.
              </p>
            </div>
            <div className="text-right">
              <p className="text-small text-text-muted">Cancellation amount due</p>
              <p className="font-heading text-h4 font-semibold text-error">
                {formatMoney((order.cancellations ?? []).reduce((sum, record) => sum + record.amountDue, 0))}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(order.cancellations ?? []).map((record, recordIndex) => (
              <article key={record._id ?? `${record.cancelledAt}-${recordIndex}`} className="rounded-xl border border-error/15 bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text">{record.reason}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(record.cancelledAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="rounded-full bg-error/10 px-2 py-1 text-xs font-semibold text-error">
                    Due {formatMoney(record.amountDue)}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {record.lines.map((line, lineIndex) => (
                    <li key={`${line.orderItemId}-${lineIndex}`} className="flex items-start justify-between gap-3 py-2 text-small">
                      <div>
                        <p className="font-medium text-text">{line.qty} × {line.nameSnapshot}</p>
                        <p className="text-text-muted">
                          {line.chargePercent}% charge on {formatMoney(line.subtotal)}
                          {line.taxLines.length > 0
                            ? ` + ${line.taxLines.map((tax) => `${tax.name} ${tax.ratePercent}%`).join(" + ")}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-text">{formatMoney(line.amountDue)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-small">
                  <span className="text-text-muted">
                    Base {formatMoney(record.baseCharge)}
                    {record.taxLines.map((tax) => ` · ${tax.name} ${formatMoney(tax.amount)}`).join("")}
                  </span>
                  <strong className="text-text">{formatMoney(record.amountDue)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!isLoading && !isError && order && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex min-w-0 flex-col-reverse gap-3 rounded-2xl bg-surface p-3">
              <CategoryTabs
                categories={categories}
                activeCategoryId={activeCategoryId}
                onSelect={setActiveCategoryId}
              />
              <div className="relative w-full shrink-0 sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search dishes…"
                  aria-label="Search dishes"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-small text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <section className="flex flex-col gap-2">
              {visibleItems.length === 0 ? (
                <p className="text-small text-text-muted">
                  {searchTerm ? "No dishes match your search." : "No dishes in this category yet."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {visibleItems.map((item) => (
                    <OrderItemTile
                      key={item.id}
                      item={item}
                      disabled={!canEditCurrentOrder}
                      onSelect={(selected) => {
                        if (!canEditCurrentOrder) return;
                        setCartError(null);
                        setCustomizeItem(selected);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <CartRail
            table={table}
            order={order}
            pendingItems={pendingItems}
            sentItems={sentItems}
            canBuild={canEditCurrentOrder}
            isSending={sendToKitchenMutation.isPending}
            isUpdating={updateItemMutation.isPending || removeItemMutation.isPending}
            onIncrement={(item) =>
              updateItemMutation.mutate({ itemId: item.id, qty: item.qty + 1 })
            }
            onDecrement={(item) => {
              if (item.qty <= 1) {
                removeItemMutation.mutate(item.id);
              } else {
                updateItemMutation.mutate({ itemId: item.id, qty: item.qty - 1 });
              }
            }}
            onRemove={(item) => removeItemMutation.mutate(item.id)}
            onSendToKitchen={() => sendToKitchenMutation.mutate()}
          />
        </div>
      )}

      {order && <a href="#order-cart" className="fixed inset-x-4 bottom-4 z-30 rounded-full bg-primary px-6 py-4 text-center font-semibold text-white shadow-lg lg:hidden">View Order · {order.items.reduce((total, item) => total + item.qty, 0)} items</a>}
      {cartError && <p role="alert" className="text-small text-error">{cartError}</p>}

      {customizeItem && (
        <ItemCustomizationModal
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          isSubmitting={addItemMutation.isPending}
          errorMessage={cartError}
          onAdd={(customization) =>
            addItemMutation.mutate({ menuItemId: customizeItem.id, ...customization })
          }
        />
      )}

      {voidModalOpen && (
        <VoidOrderModal
          onClose={() => setVoidModalOpen(false)}
          isSubmitting={voidMutation.isPending}
          errorMessage={voidError}
          onConfirm={(reason) => voidMutation.mutate(reason)}
        />
      )}
    </main>
  );
}
