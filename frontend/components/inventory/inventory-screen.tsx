"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import {
  inventoryCategoriesApi,
  inventoryItemsApi,
  suppliersApi,
  type InventoryItemInput,
} from "@/lib/inventory/api";
import type { InventoryCategory, InventoryItem } from "@/lib/inventory/types";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { AlertTriangleIcon, BoxIcon, PlusIcon, SearchIcon, WalletIcon } from "@/components/icons";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  buildInventoryCategoryNameMap,
  buildSupplierNameMap,
  InventoryTable,
} from "./inventory-table";
import { InventoryItemFormModal } from "./inventory-item-form-modal";
import { InventoryCategoryModal } from "./inventory-category-modal";
import { InventoryAdjustModal } from "./inventory-adjust-modal";
import { SupplierQuickAddModal } from "./supplier-quick-add-modal";

// PRD §2 Inventory column: Owner/Manager/Inventory Manager "Full"; Chef
// "View (deduction only)"; Cashier/Server have no access at all (no nav
// entry — see sidebar.tsx — and this screen also self-gates in case the
// URL is hit directly).
const VIEW_ROLES = new Set(["owner", "manager", "inventory_manager", "chef"]);
const MANAGE_ROLES = new Set(["owner", "manager", "inventory_manager"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function InventoryScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ mode: "add" | "edit"; item: InventoryItem | null } | null>(
    null,
  );
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [supplierQuickAddOpen, setSupplierQuickAddOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Debounced search — avoids a request per keystroke against
  // GET /api/inventory/items?search=.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: () => inventoryCategoriesApi.list(),
    enabled: canView,
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory-items", search],
    queryFn: () => inventoryItemsApi.list({ search: search || undefined }),
    enabled: canView,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.list(),
    enabled: canView,
  });

  const items = itemsQuery.data?.inventoryItems;

  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data?.suppliers ?? [], [suppliersQuery.data]);

  const categoryNameById = useMemo(() => buildInventoryCategoryNameMap(categories), [categories]);
  const supplierNameById = useMemo(() => buildSupplierNameMap(suppliers), [suppliers]);

  const kpis = useMemo(() => {
    const list = items ?? [];
    const lowStock = list.filter((item) => item.currentStock <= item.reorderThreshold).length;
    const value = list.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0);
    return { trackedItems: list.length, lowStock, value: Math.round(value) };
  }, [items]);

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => inventoryCategoriesApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      setCategoryError(null);
    },
    onError: (error) => setCategoryError(errorMessageOf(error, "Could not add the category.")),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      inventoryCategoriesApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      setCategoryError(null);
    },
    onError: (error) => setCategoryError(errorMessageOf(error, "Could not rename the category.")),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => inventoryCategoriesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      setCategoryError(null);
    },
    onError: (error) =>
      setCategoryError(errorMessageOf(error, "Could not delete the category.")),
  });

  const createItemMutation = useMutation({
    mutationFn: (input: InventoryItemInput) => inventoryItemsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setItemModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the item.")),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InventoryItemInput> }) =>
      inventoryItemsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setItemModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the item.")),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => inventoryItemsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
    onError: (error) => window.alert(errorMessageOf(error, "Could not delete this item.")),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { quantityDelta: number; reason: string } }) =>
      inventoryItemsApi.adjust(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setAdjustItem(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not save this adjustment.")),
  });

  const toggleReorderMutation = useMutation({
    mutationFn: (id: string) => inventoryItemsApi.toggleReorderRequested(id),
    onSuccess: (result) => {
      queryClient.setQueryData<{ inventoryItems: InventoryItem[] } | undefined>(
        ["inventory-items", search],
        (current) => {
          if (!current) return current;
          return {
            inventoryItems: current.inventoryItems.map((entry) =>
              entry.id === result.inventoryItem.id ? result.inventoryItem : entry,
            ),
          };
        },
      );
    },
    onError: (error) => window.alert(errorMessageOf(error, "Could not update reorder status.")),
  });

  const createSupplierMutation = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierQuickAddOpen(false);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the supplier.")),
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to Inventory.</p>
      </main>
    );
  }

  const isLoading = categoriesQuery.isLoading || itemsQuery.isLoading || suppliersQuery.isLoading;
  const isError = categoriesQuery.isError || itemsQuery.isError || suppliersQuery.isError;

  // Reorder = swap `displayOrder` with the adjacent row (two direct API
  // calls, not the rename mutation above — no optimistic UI needed here,
  // the modal re-fetches once both writes land).
  function handleReorderCategory(category: InventoryCategory, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = sorted.findIndex((entry) => entry.id === category.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = sorted[swapIndex];
    if (!neighbor) return;

    void inventoryCategoriesApi
      .update(category.id, { displayOrder: neighbor.displayOrder })
      .then(() => inventoryCategoriesApi.update(neighbor.id, { displayOrder: category.displayOrder }))
      .then(() => queryClient.invalidateQueries({ queryKey: ["inventory-categories"] }))
      .catch((error) => setCategoryError(errorMessageOf(error, "Could not reorder categories.")));
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, suppliers, and reorder status."
        action={
          canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryError(null);
                  setCategoryModalOpen(true);
                }}
                className="rounded-lg border border-border px-4 py-2 text-button text-text-muted transition-colors hover:text-text"
              >
                Categories
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setItemModal({ mode: "add", item: null });
                }}
                disabled={categories.length === 0}
                title={categories.length === 0 ? "Add a category first" : undefined}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" />
                Add Item
              </button>
            </div>
          )
        }
      />

      {isLoading && <p className="text-small text-text-muted">Loading inventory…</p>}

      {isError && (
        <p className="text-small text-error">
          Could not load inventory — check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Tracked Items" value={String(kpis.trackedItems)} icon={BoxIcon} />
            <StatCard
              label="Low on Stock"
              value={String(kpis.lowStock)}
              icon={AlertTriangleIcon}
              tone={kpis.lowStock > 0 ? "warning" : "default"}
            />
            <StatCard label="Inventory Value" value={formatMoney(kpis.value)} icon={WalletIcon} />
          </div>

          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search inventory items…"
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-body text-text"
            />
          </div>

          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-body text-text-muted">
                No inventory categories yet. Add your first category to start tracking stock.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
                >
                  Add Category
                </button>
              )}
            </div>
          )}

          {categories.length > 0 && items && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-body text-text-muted">
                {search
                  ? `No items match "${search}".`
                  : "No inventory items yet. Add your first item to start tracking stock."}
              </p>
              {canManage && !search && (
                <button
                  type="button"
                  onClick={() => setItemModal({ mode: "add", item: null })}
                  className="mt-4 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
                >
                  Add Item
                </button>
              )}
            </div>
          )}

          {items && items.length > 0 && (
            <InventoryTable
              items={items}
              categoryNameById={categoryNameById}
              supplierNameById={supplierNameById}
              canManage={canManage}
              isTogglingReorder={(target) =>
                toggleReorderMutation.isPending && toggleReorderMutation.variables === target.id
              }
              onToggleReorderRequested={(target) => toggleReorderMutation.mutate(target.id)}
              onAdjust={(target) => {
                setFormError(null);
                setAdjustItem(target);
              }}
              onEdit={(target) => {
                setFormError(null);
                setItemModal({ mode: "edit", item: target });
              }}
              onDelete={(target) => {
                if (window.confirm(`Delete "${target.name}"?`)) {
                  deleteItemMutation.mutate(target.id);
                }
              }}
            />
          )}
        </>
      )}

      {categoryModalOpen && (
        <InventoryCategoryModal
          categories={categories}
          onClose={() => setCategoryModalOpen(false)}
          onCreate={(name) => createCategoryMutation.mutate(name)}
          onRename={(category, name) => updateCategoryMutation.mutate({ id: category.id, name })}
          onReorder={handleReorderCategory}
          onDelete={(category) => {
            if (window.confirm(`Delete category "${category.name}"?`)) {
              deleteCategoryMutation.mutate(category.id);
            }
          }}
          isSubmitting={createCategoryMutation.isPending}
          errorMessage={categoryError}
        />
      )}

      {itemModal && (
        <InventoryItemFormModal
          item={itemModal.item}
          categories={categories}
          suppliers={suppliers}
          defaultCategoryId={null}
          onClose={() => {
            setItemModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (itemModal.mode === "add") {
              createItemMutation.mutate(input);
            } else if (itemModal.item) {
              updateItemMutation.mutate({ id: itemModal.item.id, input });
            }
          }}
          onRequestAddSupplier={() => {
            setFormError(null);
            setSupplierQuickAddOpen(true);
          }}
          isSubmitting={createItemMutation.isPending || updateItemMutation.isPending}
          errorMessage={formError}
        />
      )}

      {supplierQuickAddOpen && (
        <SupplierQuickAddModal
          onClose={() => setSupplierQuickAddOpen(false)}
          onSubmit={(input) => createSupplierMutation.mutate(input)}
          isSubmitting={createSupplierMutation.isPending}
          errorMessage={formError}
        />
      )}

      {adjustItem && (
        <InventoryAdjustModal
          item={adjustItem}
          onClose={() => {
            setAdjustItem(null);
            setFormError(null);
          }}
          onSubmit={(input) => adjustMutation.mutate({ id: adjustItem.id, input })}
          isSubmitting={adjustMutation.isPending}
          errorMessage={formError}
        />
      )}
    </main>
  );
}
