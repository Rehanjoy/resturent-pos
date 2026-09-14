import { api } from "@/lib/api";
import type { DiningContext, DiningSeat, DiningSessionResponse, CartItem, DiningCustomer, DiningNotificationPage, ServiceRequest, ServiceRequestType, SelectedCancellationQuote } from "./types";

const path = (qrToken: string) => `/api/public/dining/${encodeURIComponent(qrToken)}`;
const authorization = (sessionToken: string) => ({ "X-Dining-Token": sessionToken });

export const diningApi = {
  context: (qrToken: string) => api.get<DiningContext>(`${path(qrToken)}/context`),
  hold: (qrToken: string, partySize: number, seats: DiningSeat[], customer: DiningCustomer, bookingMode?: "whole_table" | "chairs") => api.post<DiningSessionResponse & { sessionToken: string }>(`${path(qrToken)}/holds`, { partySize, seats, customer, bookingMode }),
  session: (qrToken: string, sessionToken: string) => api.get<DiningSessionResponse>(`${path(qrToken)}/session`, authorization(sessionToken)),
  order: (qrToken: string, sessionToken: string, items: CartItem[], idempotencyKey: string) => api.post<DiningSessionResponse>(`${path(qrToken)}/order`, { items: items.map(({ menuItemId, qty, notes }) => ({ menuItemId, qty, notes })), idempotencyKey }, authorization(sessionToken)),
  cancellationQuote: (qrToken: string, sessionToken: string, items: { orderItemId: string; qty: number }[]) => api.post<SelectedCancellationQuote>(`${path(qrToken)}/cancel/quote`, { items }, authorization(sessionToken)),
  cancelItems: (qrToken: string, sessionToken: string, reason: string, items: { orderItemId: string; qty: number; acceptedChargePercent: number }[]) => api.post<DiningSessionResponse>(`${path(qrToken)}/cancel`, { reason, items }, authorization(sessionToken)),
  serviceRequests: (qrToken: string, sessionToken: string) => api.get<ServiceRequest[]>(`${path(qrToken)}/service-requests`, authorization(sessionToken)),
  requestService: (qrToken: string, sessionToken: string, type: ServiceRequestType, note?: string) => api.post<ServiceRequest>(`${path(qrToken)}/service-requests`, { type, note }, authorization(sessionToken)),
  notifications: (qrToken: string, sessionToken: string, options: { cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(options.limit ?? 30) });
    if (options.cursor) query.set("cursor", options.cursor);
    return api.get<DiningNotificationPage>(`${path(qrToken)}/notifications?${query.toString()}`, authorization(sessionToken));
  },
  markNotificationRead: (qrToken: string, sessionToken: string, notificationId: string) =>
    api.patch<{ notification: { id: string; read: boolean } }>(`${path(qrToken)}/notifications/${encodeURIComponent(notificationId)}/read`, {}, authorization(sessionToken)),
};

export function remainingTime(until: string | null | undefined, now: number): string {
  const seconds = until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
