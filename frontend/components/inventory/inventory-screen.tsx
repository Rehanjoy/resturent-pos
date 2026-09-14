"use client";

import { useMemo, useState } from "react";
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
import { InventoryAdjustModal, type InventoryMovementInput } from "./inventory-adjust-modal";
import { SupplierQuickAddModal } from "./supplier-quick-add-modal";
import { menuItemsApi } from "@/lib/menu/api";
import dynamic from "next/dynamic";
import { formatStockQuantity } from "@/lib/inventory/units";
import { IngredientHistoryModal } from "./ingredient-history-modal";

const CostingWorkspace = dynamic(() => import("./costing-workspace").then(module => module.CostingWorkspace), { loading: () => <p role="status">Loading dish profitability…</p> });

const ProductionPlanner = dynamic(() => import("./production-planner").then(module => module.ProductionPlanner), {
  loading: () => <div className="h-20 animate-pulse rounded-3xl bg-white" aria-label="Loading production planner" />,
});

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
  const search = searchInput.trim();
  const [section, setSection] = useState("ingredients");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ mode: "add" | "edit"; item: InventoryItem | null } | null>(
    null,
  );
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [supplierQuickAddOpen, setSupplierQuickAddOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: () => inventoryCategoriesApi.list(),
    enabled: canView,
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => inventoryItemsApi.list(),
    refetchInterval: 30_000,
    enabled: canView,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.list(),
    enabled: canView,
  });
  const menuQuery = useQuery({ queryKey: ["menu-items"], queryFn: () => menuItemsApi.list(), enabled: canView });

  const items = itemsQuery.data?.inventoryItems;

  const visibleItems = useMemo(() => (items ?? []).filter(item =>
    (!categoryFilter || item.categoryId === categoryFilter) &&
    (!search || item.name.toLowerCase().includes(search.toLowerCase())) &&
    (stockFilter === "all" || (stockFilter === "low" ? item.currentStock <= item.reorderThreshold : stockFilter === "critical" ? item.currentStock <= 0 : item.currentStock > item.reorderThreshold))
  ).sort((a, b) => sort === "value" ? b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit : sort === "stock" ? a.currentStock - b.currentStock : a.name.localeCompare(b.name)), [items, categoryFilter, search, stockFilter, sort]);
  const linkedDishCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dish of menuQuery.data?.menuItems ?? []) for (const id of new Set((dish.ingredientMapping ?? []).map(row => row.inventoryItemId))) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, [menuQuery.data]);

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
    mutationFn: ({ id, input }: { id: string; input: InventoryMovementInput }) =>
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
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

  const isLoading = categoriesQuery.isLoading || itemsQuery.isLoading || suppliersQuery.isLoading || menuQuery.isLoading;
  const isError = categoriesQuery.isError || itemsQuery.isError || suppliersQuery.isError || menuQuery.isError;

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
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-3 py-5 sm:px-6 sm:py-8">
      <PageHeader
        title="Inventory & food cost"
        subtitle="One ingredient register. Linked recipes. Clear dish costs and daily stock control."
        action={
          canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryError(null);
                  setCategoryModalOpen(true);
                }}
                className="min-h-11 rounded-lg border border-border px-4 py-2 text-button text-text-muted transition-colors hover:text-text"
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
                className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
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
          Could not load inventory — check your connection. <button className="min-h-11 underline" onClick={() => { void itemsQuery.refetch(); void categoriesQuery.refetch(); void suppliersQuery.refetch(); void menuQuery.refetch(); }}>Retry loading</button>
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

          {items && items.some((item) => item.currentStock <= item.reorderThreshold) && (
            <section aria-label="Stock alerts" className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <h2 className="font-semibold text-text">Restock attention needed</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.filter((item) => item.currentStock <= item.reorderThreshold).map((item) => (
                  <span key={item.id} className={`rounded-full bg-surface px-3 py-2 text-small ${item.currentStock <= 0 ? "text-error" : "text-text"}`}>
                    {item.currentStock <= 0 ? "Critical" : "Low stock"}: {item.name} · {formatStockQuantity(item.currentStock, item.unit)}
                    {item.reorderRequested ? " · delivery pending" : " · reorder now"}
                  </span>
                ))}
              </div>
            </section>
          )}
          <nav aria-label="Inventory workspaces" className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-2">
            {[["ingredients", "Ingredients"], ["recipes", "Recipes & production"], ["costing", "Dish profitability"]].map(([value, label]) => <button key={value} type="button" aria-current={section === value ? "page" : undefined} onClick={() => setSection(value)} className={`min-h-11 rounded-xl px-4 font-semibold ${section === value ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-background"}`}>{label}</button>)}
          </nav>
          {section === "recipes" && items && menuQuery.data && <ProductionPlanner menu={menuQuery.data.menuItems} inventory={items} canManage={canManage || user.role === "chef"} />}
          {section === "costing" && <CostingWorkspace />}
          {section === "ingredients" && <>
          <div className="flex flex-wrap gap-2" aria-label="Ingredient categories">
            <button type="button" onClick={() => setCategoryFilter("")} aria-pressed={!categoryFilter} className={`min-h-11 rounded-full border px-4 text-sm ${!categoryFilter ? "border-primary text-primary" : "border-border"}`}>All ingredients ({items?.length ?? 0})</button>
            {categories.map(category => <button key={category.id} type="button" onClick={() => setCategoryFilter(category.id)} aria-pressed={categoryFilter === category.id} className={`min-h-11 rounded-full border px-4 text-sm ${categoryFilter === category.id ? "border-primary text-primary" : "border-border"}`}>{category.name} ({items?.filter(item => item.categoryId === category.id).length ?? 0})</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">Stock status<select value={stockFilter} onChange={event => setStockFilter(event.target.value)} className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3"><option value="all">All stock</option><option value="low">Low stock</option><option value="critical">Out of stock</option><option value="healthy">Healthy</option></select></label>
            <label className="text-sm">Sort<select value={sort} onChange={event => setSort(event.target.value)} className="ml-2 min-h-11 rounded-xl border border-border bg-surface px-3"><option value="name">Name A–Z</option><option value="value">Highest stock value</option><option value="stock">Lowest base-unit quantity</option></select></label>
          </div>
          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search inventory items"
              placeholder="Search inventory items…"
              className="min-h-11 w-full rounded-lg border border-border py-2 pl-9 pr-3 text-body text-text"
            />
          </div>

          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-body text-text-muted">
                No inventory categories yet. Add your first category to start tracking stock.
              </p>
              {canManage && <div className="mt-4 flex flex-wrap justify-center gap-2">{["Grains & rice", "Vegetables", "Meat & seafood", "Dairy", "Oil & fats", "Spices"].map(name => <button type="button" key={name} disabled={createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate(name)} className="min-h-11 rounded-full border border-border px-3 text-sm">+ {name}</button>)}</div>}
              {categoryError && <p role="alert" className="mt-2 text-error">{categoryError}</p>}
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

          {categories.length > 0 && visibleItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-body text-text-muted">
                {search
                  ? `No items match "${search}".`
                  : items?.length ? "No ingredients match these filters. Change category or stock status." : "No inventory items yet. Add your first item to start tracking stock."}
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

          {visibleItems.length > 0 && (
            <InventoryTable
              items={visibleItems}
              linkedDishCounts={linkedDishCounts}
              categoryNameById={categoryNameById}
              supplierNameById={supplierNameById}
              canManage={canManage}
              isTogglingReorder={(target) =>
                toggleReorderMutation.isPending && toggleReorderMutation.variables === target.id
              }
              onToggleReorderRequested={(target) => toggleReorderMutation.mutate(target.id)}
              onOpenHistory={setHistoryItem}
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
          </>}
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
          defaultCategoryId={categoryFilter || null}
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

      {historyItem && <IngredientHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
    </main>
  );
}
