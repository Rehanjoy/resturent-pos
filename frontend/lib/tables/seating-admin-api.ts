import { api } from "@/lib/api";
import type { Order } from "@/lib/orders/types";

export interface DiningPolicy {
  holdMinutes: number;
  freeCancellationMinutes: number;
  partialCancellationMinutes: number;
  partialChargePercent: number;
  defaultPrepMinutes: number;
}
export interface SeatSelection { tableId: string; chairNumber: number }
export interface FloorTable {
  id: string; name: string; areaId: string; areaName: string;
  seatingCapacity: number; shape: string; status: string;
  chairs: { number: number; status: "available" | "held" | "occupied" | "unavailable" }[];
}
export interface FloorSession {
  id: string; source: string; status: string; partySize: number;
  seats: SeatSelection[]; expiresAt?: string | null; orderId?: string;
  customer?: { name: string; phone: string }; createdAt: string; releasedAt?: string;
}
export interface FloorState {
  tables: FloorTable[]; sessions: FloorSession[]; policy: DiningPolicy; serverNow: string;
}
export interface FloorServiceRequest { id: string; sessionId: string; type: "water" | "bill" | "help"; note: string; status: "pending" | "acknowledged"; seats: { tableId: string; chairNumber: number; tableName: string }[]; createdAt: string; acknowledgedAt: string | null }
export const seatingAdminApi = {
  get: () => api.get<FloorState>("/api/dining"),
  hold: (partySize: number, seats: SeatSelection[], customer?: { name: string; phone: string }) => api.post("/api/dining/holds", { partySize, seats, customer }),
  release: (id: string, reason: string) => api.post(`/api/dining/sessions/${id}/release`, { reason }),
  order: (id: string) => api.post<{ order: Order }>(`/api/dining/sessions/${id}/order`, {}),
  qr: (id: string) => api.get<{ table: { id: string; name: string }; codes: { chairNumber: number; token: string; url: string; svg: string }[] }>(`/api/dining/tables/${id}/qr`),
  policy: (policy: DiningPolicy) => api.patch<{ policy: DiningPolicy }>("/api/dining/policy", policy),
  preparation: (id: string, prepMinutes: number) => api.patch(`/api/dining/menu/${id}/preparation`, { prepMinutes }),
  eta: (orderId: string, itemId: string, minutes: number) => api.patch(`/api/dining/orders/${orderId}/items/${itemId}/eta`, { minutes }),
  requests: () => api.get<FloorServiceRequest[]>("/api/service-requests"),
  updateRequest: (id: string, status: "acknowledged" | "completed") => api.patch(`/api/service-requests/${id}`, { status }),
};
