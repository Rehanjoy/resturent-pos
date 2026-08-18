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
import { connectSocket } from "@/lib/socket";
import { PageHeader } from "@/components/ui/page-header";
import { SearchIcon } from "@/components/icons";
import { CategoryTabs } from "./category-tabs";
import { OrderItemTile } from "./order-item-tile";
import { ItemCustomizationModal, type ItemCustomization } from "./item-customization-modal";
import { CartRail } from "./cart-rail";
import { VoidOrderModal } from "./void-order-modal";

const BUILD_ROLES = new Set(["owner", "manager", "cashier", "server"]);
const VOID_ROLES = new Set(["owner", "manager"]);
const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);
const NON_VOIDABLE: OrderStatus[] = ["billed", "closed", "void"];

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
export function OrderWorkspace({ tableId, mode }: { tableId: string; mode: "new" | "active" }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canBuild = !!user && BUILD_ROLES.has(user.role);
  const canVoid = !!user && VOID_ROLES.has(user.role);
  const canBill = !!user && BILLING_ROLES.has(user.role);

  const [orderId, setOrderId] = useState<string | null>(null);
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
    openOrderMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(orderId as string).then((result) => result.order),
    enabled: !!orderId,
  });

  const order = orderQuery.data;

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

  useEffect(() => {
    if (!orderId) return;
    const socket = connectSocket();
    const handleOrderUpdated = (event: OrderUpdatedEvent) => {
      if (event.order.id !== orderId) return;
      queryClient.setQueryData(["order", orderId], event.order);
    };
    socket.on("order:updated", handleOrderUpdated);
    return () => {
      socket.off("order:updated", handleOrderUpdated);
    };
  }, [orderId, queryClient]);

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
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title={table ? table.name : "Order"}
        subtitle={order ? `Status: ${STATUS_LABEL[order.status]}` : undefined}
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
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
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
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleItems.map((item) => (
                    <OrderItemTile
                      key={item.id}
                      item={item}
                      onSelect={(selected) => {
                        if (!canBuild) return;
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
            canBuild={canBuild}
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

      {cartError && <p className="text-small text-error">{cartError}</p>}

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
