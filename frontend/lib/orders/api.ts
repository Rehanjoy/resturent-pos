import { api } from "@/lib/api";
import type { SpiceLevel } from "@/lib/menu/types";
import type { Kot, Order, OrderStatus } from "./types";

export interface AddOrderItemInput {
  menuItemId: string;
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns?: string[];
  notes?: string;
}

export interface UpdateOrderItemInput {
  itemId: string;
  qty?: number;
  spiceLevel?: SpiceLevel;
  addOns?: string[];
  notes?: string;
}

export interface EditOrderItemsInput {
  addItems?: AddOrderItemInput[];
  updateItems?: UpdateOrderItemInput[];
  removeItemIds?: string[];
}

/**
 * Typed endpoint calls for the Order Management module, all going through
 * the single transport client in `lib/api.ts` (same pattern as
 * `lib/tables/api.ts` / `lib/menu/api.ts`).
 */
export const ordersApi = {
  list: (filters?: { status?: OrderStatus; tableId?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.tableId) params.set("tableId", filters.tableId);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    const query = params.toString();
    return api.get<{ orders: Order[] }>(`/api/orders${query ? `?${query}` : ""}`);
  },

  get: (id: string) => api.get<{ order: Order }>(`/api/orders/${id}`),

  /** Creates the draft order for a table, or returns the table's existing
   * live order if one already exists (see backend `createOrder` doc). */
  create: (tableId: string) =>
    api.post<{ order: Order }>("/api/orders", { tableId }),

  editItems: (id: string, input: EditOrderItemsInput) =>
    api.patch<{ order: Order }>(`/api/orders/${id}`, input),

  sendToKitchen: (id: string) =>
    api.post<{ order: Order; kot: Kot }>(`/api/orders/${id}/send-kitchen`),

  serve: (id: string, itemIds?: string[]) =>
    api.post<{ order: Order }>(`/api/orders/${id}/serve`, itemIds ? { itemIds } : undefined),

  voidOrder: (id: string, reason: string) =>
    api.delete<{ order: Order }>(`/api/orders/${id}/void`, { reason }),
};
