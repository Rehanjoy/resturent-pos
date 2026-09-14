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
export type BookingMode = "whole_table" | "chairs";
export type FloorChairStatus = "available" | "held" | "occupied" | "cleaning" | "unavailable";
export interface AssignedWaiter { id: string; name: string }
export interface FloorTable {
  id: string; name: string; areaId: string; areaName: string;
  seatingCapacity: number; shape: string; status: string;
  chairs: { number: number; status: FloorChairStatus }[];
  bookingMode: BookingMode | null;
  wholeTableOccupied: boolean;
  wholeTableCleaning: boolean;
  assignedWaiter: AssignedWaiter | null;
}
export interface FloorSession {
  id: string; source: string; status: "held" | "occupied" | "cleaning" | "expired" | "released"; partySize: number;
  seats: SeatSelection[]; expiresAt?: string | null; orderId?: string;
  customer?: { name: string; phone: string }; createdAt: string; releasedAt?: string;
  bookingMode: BookingMode;
  assignedWaiter: AssignedWaiter | null;
}
export interface FloorState {
  tables: FloorTable[]; sessions: FloorSession[]; policy: DiningPolicy; serverNow: string;
}
export interface FloorServiceRequest { id: string; sessionId: string; type: "water" | "bill" | "help"; note: string; status: "pending" | "acknowledged"; seats: { tableId: string; chairNumber: number; tableName: string }[]; createdAt: string; acknowledgedAt: string | null; assignedWaiter: AssignedWaiter | null; customer: { name: string; phone: string } | null; bookingMode: BookingMode }
export const seatingAdminApi = {
  get: () => api.get<FloorState>("/api/dining"),
  hold: (partySize: number, seats: SeatSelection[], customer: { name: string; phone: string } | undefined, bookingMode: BookingMode) => api.post("/api/dining/holds", { partySize, seats, customer, bookingMode }),
  release: (id: string, reason: string) => api.post(`/api/dining/sessions/${id}/release`, { reason }),
  markAvailable: (id: string) => api.post(`/api/dining/sessions/${id}/available`, {}),
  order: (id: string) => api.post<{ order: Order }>(`/api/dining/sessions/${id}/order`, {}),
  qr: (id: string) => api.get<{ table: { id: string; name: string }; codes: { chairNumber: number; token: string; url: string; svg: string }[] }>(`/api/dining/tables/${id}/qr`),
  policy: (policy: DiningPolicy) => api.patch<{ policy: DiningPolicy }>("/api/dining/policy", policy),
  preparation: (id: string, prepMinutes: number) => api.patch(`/api/dining/menu/${id}/preparation`, { prepMinutes }),
  eta: (orderId: string, itemId: string, minutes: number) => api.patch(`/api/dining/orders/${orderId}/items/${itemId}/eta`, { minutes }),
  requests: () => api.get<FloorServiceRequest[]>("/api/service-requests"),
  updateRequest: (id: string, status: "acknowledged" | "completed") => api.patch(`/api/service-requests/${id}`, { status }),
};
