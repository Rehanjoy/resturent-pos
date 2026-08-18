import { api } from "@/lib/api";
import type { Reservation, ReservationStatus } from "./types";

export interface ReservationInput {
  guestName: string;
  guestPhone: string;
  partySize: number;
  /** ISO datetime string. */
  reservationTime: string;
  tableId?: string;
  notes?: string;
}

/**
 * Typed endpoint calls for the Reservations module, all through the single
 * transport client in `lib/api.ts` (same pattern as `lib/tables/api.ts`).
 */
export const reservationsApi = {
  list: (filters: { date?: string; status?: ReservationStatus } = {}) => {
    const params = new URLSearchParams();
    if (filters.date) params.set("date", filters.date);
    if (filters.status) params.set("status", filters.status);
    const query = params.toString();
    return api.get<{ reservations: Reservation[] }>(
      `/api/reservations${query ? `?${query}` : ""}`,
    );
  },

  // `status` on create only ever needs to be "confirmed" (default) or
  // "waitlist" — matches `createReservationSchema` on the backend.
  create: (input: ReservationInput & { status?: "confirmed" | "waitlist" }) =>
    api.post<{ reservation: Reservation }>("/api/reservations", input),

  // `tableId: null` explicitly un-assigns the table (releases the hold);
  // `status` here is deliberately never `"seated"` — that transition only
  // happens through `seat` below, matching the backend's
  // `updateReservationSchema`.
  update: (
    id: string,
    input: Partial<Omit<ReservationInput, "tableId">> & {
      tableId?: string | null;
      status?: Exclude<ReservationStatus, "seated">;
    },
  ) => api.patch<{ reservation: Reservation }>(`/api/reservations/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/reservations/${id}`),

  seat: (id: string, input: { tableId?: string } = {}) =>
    api.patch<{ reservation: Reservation }>(`/api/reservations/${id}/seat`, input),
};
