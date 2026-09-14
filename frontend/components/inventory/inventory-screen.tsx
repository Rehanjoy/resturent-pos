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
import {
  AlertTriangleIcon,
  BoxIcon,
  ChefHatIcon,
  PlusIcon,
  SearchIcon,
  WalletIcon,
} from "@/components/icons";
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

const CostingWorkspace = dynamic(
  () => import("./costing-workspace").then((module) => module.CostingWorkspace),
  { loading: () => <p role="status">Loading dish profitability…</p> }
);

const ProductionPlanner = dynamic(
  () => import("./production-planner").then((module) => module.ProductionPlanner),
  {
    loading: () => (
      <div className="h-20 animate-pulse rounded-3xl bg-white" aria-label="Loading production planner" />
    ),
  }
);

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
    null
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

  const menuQuery = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => menuItemsApi.list(),
    enabled: canView,
  });

  const items = itemsQuery.data?.inventoryItems;

  const visibleItems = useMemo(
    () =>
      (items ?? [])
        .filter(
          (item) =>
            (!categoryFilter || item.categoryId === categoryFilter) &&
            (!search || item.name.toLowerCase().includes(search.toLowerCase())) &&
            (stockFilter === "all" ||
              (stockFilter === "low"
                ? item.currentStock <= item.reorderThreshold
                : stockFilter === "critical"
                ? item.currentStock <= 0
                : item.currentStock > item.reorderThreshold))
        )
        .sort((a, b) =>
          sort === "value"
            ? b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit
            : sort === "stock"
            ? a.currentStock - b.currentStock
            : a.name.localeCompare(b.name)
        ),
    [items, categoryFilter, search, stockFilter, sort]
  );

  const linkedDishCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dish of menuQuery.data?.menuItems ?? []) {
      for (const id of new Set((dish.ingredientMapping ?? []).map((row) => row.inventoryItemId))) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
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

  const isLoading =
    categoriesQuery.isLoading || itemsQuery.isLoading || suppliersQuery.isLoading || menuQuery.isLoading;
  const isError =
    categoriesQuery.isError || itemsQuery.isError || suppliersQuery.isError || menuQuery.isError;

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
        title="Inventory & Food Cost"
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
                className="min-h-11 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-text shadow-2xs transition-colors hover:bg-background hover:text-text"
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
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary disabled:opacity-60"
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
          Could not load inventory — check your connection.{" "}
          <button
            className="min-h-11 underline"
            onClick={() => {
              void itemsQuery.refetch();
              void categoriesQuery.refetch();
              void suppliersQuery.refetch();
              void menuQuery.refetch();
            }}
          >
            Retry loading
          </button>
        </p>
      )}

      {!isLoading && !isError && (
        <>
          {/* KPI Stat Cards */}
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

          {/* Stock Alerts Banner */}
          {items && items.some((item) => item.currentStock <= item.reorderThreshold) && (
            <section
              aria-label="Stock alerts"
              className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/20 text-warning">
                    <AlertTriangleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">Restock Attention Needed</h2>
                    <p className="text-xs text-text-muted">
                      {items.filter((item) => item.currentStock <= item.reorderThreshold).length} ingredient(s) are at or below reorder threshold.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStockFilter((curr) => (curr === "low" ? "all" : "low"))}
                  className="rounded-lg border border-warning/40 bg-surface px-3 py-1 text-xs font-semibold text-text hover:bg-warning/15 transition-colors"
                >
                  {stockFilter === "low" ? "Show All Ingredients" : "Filter Low Stock Only"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {items
                  .filter((item) => item.currentStock <= item.reorderThreshold)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSearchInput(item.name);
                        setStockFilter("all");
                      }}
                      title="Click to search this ingredient"
                      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium transition-colors hover:border-primary ${
                        item.currentStock <= 0 ? "text-error" : "text-text"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.currentStock <= 0 ? "bg-error" : "bg-warning"
                        }`}
                      />
                      <strong>{item.name}</strong>: {formatStockQuantity(item.currentStock, item.unit)}
                      <span className="text-text-muted text-[11px]">
                        {item.reorderRequested ? "(Reorder pending)" : "(Reorder now)"}
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          )}

          {/* Workspace Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Inventory workspaces"
              className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1.5 shadow-2xs"
            >
              {[
                { id: "ingredients", label: "Ingredients Register", count: items?.length, icon: BoxIcon },
                { id: "recipes", label: "Recipes & Production", icon: ChefHatIcon },
                { id: "costing", label: "Dish Profitability", icon: WalletIcon },
              ].map(({ id, label, count, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={section === id ? "page" : undefined}
                  onClick={() => setSection(id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    section === id
                      ? "bg-primary text-white shadow-xs"
                      : "text-text-muted hover:bg-background hover:text-text"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        section === id ? "bg-white/20 text-white" : "bg-background text-text-muted"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {section === "recipes" && items && menuQuery.data && (
            <ProductionPlanner
              menu={menuQuery.data.menuItems}
              inventory={items}
              canManage={canManage || user.role === "chef"}
            />
          )}

          {section === "costing" && <CostingWorkspace />}

          {section === "ingredients" && (
            <div className="space-y-4">
              {/* Unified Search & Filter Toolbar */}
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-3">
                {/* Search & Select Controls */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      aria-label="Search inventory items"
                      placeholder="Search ingredients by name..."
                      className="min-h-10 w-full rounded-xl border border-border bg-background/50 py-2 pl-9 pr-8 text-xs font-medium text-text placeholder:text-text-muted shadow-2xs transition-colors focus:border-primary focus:bg-surface focus:outline-none"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => setSearchInput("")}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted hover:text-text"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Stock Status & Sort Filters */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text">
                      <span className="text-text-muted whitespace-nowrap">Status:</span>
                      <select
                        value={stockFilter}
                        onChange={(event) => setStockFilter(event.target.value)}
                        className="min-h-10 rounded-xl border border-border bg-surface px-3 py-1 text-xs font-semibold text-text shadow-2xs transition-colors focus:border-primary focus:outline-none"
                      >
                        <option value="all">All stock</option>
                        <option value="low">Low stock</option>
                        <option value="critical">Out of stock</option>
                        <option value="healthy">Healthy</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-medium text-text">
                      <span className="text-text-muted whitespace-nowrap">Sort:</span>
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                        className="min-h-10 rounded-xl border border-border bg-surface px-3 py-1 text-xs font-semibold text-text shadow-2xs transition-colors focus:border-primary focus:outline-none"
                      >
                        <option value="name">Name A–Z</option>
                        <option value="value">Highest stock value</option>
                        <option value="stock">Lowest stock quantity</option>
                      </select>
                    </label>

                    {(categoryFilter || searchInput || stockFilter !== "all" || sort !== "name") && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter("");
                          setSearchInput("");
                          setStockFilter("all");
                          setSort("name");
                        }}
                        className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold text-text-muted hover:bg-background hover:text-text transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Pills Row */}
                <div
                  className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3"
                  aria-label="Ingredient categories"
                >
                  <span className="text-xs font-semibold text-text-muted mr-1">Category:</span>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("")}
                    aria-pressed={!categoryFilter}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      !categoryFilter
                        ? "bg-primary text-white shadow-2xs"
                        : "border border-border bg-surface text-text-muted hover:bg-background hover:text-text"
                    }`}
                  >
                    All ({items?.length ?? 0})
                  </button>
                  {categories.map((category) => {
                    const count = items?.filter((item) => item.categoryId === category.id).length ?? 0;
                    const isActive = categoryFilter === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryFilter(category.id)}
                        aria-pressed={isActive}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-white shadow-2xs"
                            : "border border-border bg-surface text-text-muted hover:bg-background hover:text-text"
                        }`}
                      >
                        {category.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {categories.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
                  <p className="text-body text-text-muted">
                    No inventory categories yet. Add your first category to start tracking stock.
                  </p>
                  {canManage && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {["Grains & rice", "Vegetables", "Meat & seafood", "Dairy", "Oil & fats", "Spices"].map(
                        (name) => (
                          <button
                            type="button"
                            key={name}
                            disabled={createCategoryMutation.isPending}
                            onClick={() => createCategoryMutation.mutate(name)}
                            className="min-h-11 rounded-full border border-border px-3 text-sm hover:border-primary transition-colors"
                          >
                            + {name}
                          </button>
                        )
                      )}
                    </div>
                  )}
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
                      : items?.length
                      ? "No ingredients match these filters. Change category or stock status."
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
            </div>
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
