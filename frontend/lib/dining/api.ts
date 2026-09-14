import { api } from "@/lib/api";
import type { DiningContext, DiningSeat, DiningSessionResponse, CartItem, DiningCustomer, ServiceRequest, ServiceRequestType } from "./types";

const path = (qrToken: string) => `/api/public/dining/${encodeURIComponent(qrToken)}`;
const authorization = (sessionToken: string) => ({ "X-Dining-Token": sessionToken });

export const diningApi = {
  context: (qrToken: string) => api.get<DiningContext>(`${path(qrToken)}/context`),
  hold: (qrToken: string, partySize: number, seats: DiningSeat[], customer: DiningCustomer) => api.post<DiningSessionResponse & { sessionToken: string }>(`${path(qrToken)}/holds`, { partySize, seats, customer }),
  session: (qrToken: string, sessionToken: string) => api.get<DiningSessionResponse>(`${path(qrToken)}/session`, authorization(sessionToken)),
  order: (qrToken: string, sessionToken: string, items: CartItem[], idempotencyKey: string) => api.post<DiningSessionResponse>(`${path(qrToken)}/order`, { items: items.map(({ menuItemId, qty, notes }) => ({ menuItemId, qty, notes })), idempotencyKey }, authorization(sessionToken)),
  cancel: (qrToken: string, sessionToken: string, reason: string, acceptedChargePercent: number) => api.post<DiningSessionResponse>(`${path(qrToken)}/cancel`, { reason, acceptedChargePercent }, authorization(sessionToken)),
  serviceRequests: (qrToken: string, sessionToken: string) => api.get<ServiceRequest[]>(`${path(qrToken)}/service-requests`, authorization(sessionToken)),
  requestService: (qrToken: string, sessionToken: string, type: ServiceRequestType, note?: string) => api.post<ServiceRequest>(`${path(qrToken)}/service-requests`, { type, note }, authorization(sessionToken)),
};

export function remainingTime(until: string | null | undefined, now: number): string {
  const seconds = until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
