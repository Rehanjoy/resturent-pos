import { api } from "@/lib/api";
import type { Kot } from "@/lib/orders/types";

/**
 * Typed endpoint calls for the Kitchen Display System (PRD §3.4). Order
 * and ticket data share the same `Order`/`Kot` shapes from
 * `lib/orders/types.ts` — the backend order and kitchen routes serialize
 * with the same DTO functions.
 */
export const kitchenApi = {
  listTickets: () => api.get<{ tickets: Kot[] }>("/api/kitchen/tickets"),

  markItemReady: (kotId: string, orderItemId: string) =>
    api.patch<{ kot: Kot }>(`/api/kitchen/tickets/${kotId}/item-ready`, { orderItemId }),

  markAllReady: (kotId: string) =>
    api.patch<{ kot: Kot }>(`/api/kitchen/tickets/${kotId}/mark-all-ready`),
};
