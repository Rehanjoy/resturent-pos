export const RESERVATION_STATUSES = [
  "confirmed",
  "waitlist",
  "seated",
  "no_show",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Mirrors `backend/src/services/reservation.service.ts` `ReservationDto`. */
export interface Reservation {
  id: string;
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: string;
  tableId?: string;
  status: ReservationStatus;
  notes?: string;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}
