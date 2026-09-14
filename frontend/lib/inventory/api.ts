import { api } from "@/lib/api";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionType,
  Supplier,
  ProductionPlanDetail,
} from "./types";

export const inventoryCategoriesApi = {
  list: () => api.get<{ categories: InventoryCategory[] }>("/api/inventory/categories"),

  create: (input: { name: string; displayOrder?: number }) =>
    api.post<{ category: InventoryCategory }>("/api/inventory/categories", input),

  update: (id: string, input: { name?: string; displayOrder?: number }) =>
    api.patch<{ category: InventoryCategory }>(`/api/inventory/categories/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/inventory/categories/${id}`),
};

export const productionApi = {
  get: (day: string) => api.get<ProductionPlanDetail>(`/api/inventory/production?day=${encodeURIComponent(day)}`),
  savePlan: (day: string, dishes: { menuItemId: string; portions: number }[]) => api.post<ProductionPlanDetail>("/api/inventory/production/plans", { day, dishes }),
  saveRecipe: (id: string, yieldPortions: number, ingredients: { inventoryItemId: string; quantity: number }[]) => api.patch<{ id: string; name: string; yieldPortions: number }>(`/api/inventory/production/recipes/${id}`, { yieldPortions, ingredients }),
  reconcile: (planId: string, itemId: string, input: { actualUsed: number; actualWasted: number; expectedStock: number; recordedUsed: number; recordedWasted: number }) => api.post<ProductionPlanDetail>(`/api/inventory/production/plans/${planId}/items/${itemId}/reconcile`, input),
};

export interface InventoryItemInput {
  categoryId: string;
  name: string;
  unit: string;
  /** Integer paise. */
  costPerUnit: number;
  currentStock?: number;
  reorderThreshold?: number;
  expectedDailyUsage?: number;
  supplierId?: string;
}

export const inventoryItemsApi = {
  list: (filters: { categoryId?: string; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.search) params.set("search", filters.search);
    const query = params.toString();
    return api.get<{ inventoryItems: InventoryItem[] }>(
      `/api/inventory/items${query ? `?${query}` : ""}`,
    );
  },

  create: (input: InventoryItemInput) =>
    api.post<{ inventoryItem: InventoryItem }>("/api/inventory/items", input),

  update: (id: string, input: Partial<InventoryItemInput>) =>
    api.patch<{ inventoryItem: InventoryItem }>(`/api/inventory/items/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/inventory/items/${id}`),

  adjust: (id: string, input: { quantityDelta: number; reason: string; movementType?: "restock" | "usage" | "wastage" | "adjustment" }) =>
    api.post<{ inventoryItem: InventoryItem }>(`/api/inventory/items/${id}/adjust`, input),

  toggleReorderRequested: (id: string) =>
    api.patch<{ inventoryItem: InventoryItem }>(`/api/inventory/items/${id}/reorder-requested`),
};

export const suppliersApi = {
  list: () => api.get<{ suppliers: Supplier[] }>("/api/inventory/suppliers"),

  create: (input: { name: string; contactPhone?: string; contactEmail?: string; notes?: string }) =>
    api.post<{ supplier: Supplier }>("/api/inventory/suppliers", input),

  update: (
    id: string,
    input: Partial<{ name: string; contactPhone: string; contactEmail: string; notes: string }>,
  ) => api.patch<{ supplier: Supplier }>(`/api/inventory/suppliers/${id}`, input),
};

export const inventoryTransactionsApi = {
  list: (filters: { itemId?: string; type?: InventoryTransactionType; from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.itemId) params.set("itemId", filters.itemId);
    if (filters.type) params.set("type", filters.type);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const query = params.toString();
    return api.get<{ transactions: InventoryTransaction[] }>(
      `/api/inventory/transactions${query ? `?${query}` : ""}`,
    );
  },
};
