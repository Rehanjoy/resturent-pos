import { Schema, model, type Types } from "mongoose";

// PRD §3.7 lists reservation status as `Upcoming / Seated / No-show /
// Cancelled`, but the client's reference screenshot for this screen shows
// `Confirmed / Waitlist / Seated / No-show / Cancelled` instead. This build
// follows the client's screenshot (it's the more specific, more recent
// source) and reconciles the wording gap as follows: `confirmed` is the
// concrete state behind the PRD's "Upcoming" label (a reservation with a
// locked-in slot); `waitlist` is a new state the PRD didn't call out
// separately — a guest who wants a slot but doesn't have a confirmed one
// yet, in case of a cancellation/no-show elsewhere. Both `confirmed` and
// `waitlist` are treated identically by the table-hold logic below (see
// `reservation.service.ts` `HOLD_STATUSES`).
export const RESERVATION_STATUSES = [
  "confirmed",
  "waitlist",
  "seated",
  "no_show",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ReservationDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: Date;
  /** Optional — PRD §3.7 "preferred table (optional)". When set and the
   * reservation is `confirmed`/`waitlist`, the referenced `Table.status` is
   * held at `reserved` — see `reservation.service.ts` for the full
   * event-triggered table-hold design (no cron/time-window in this
   * codebase, same gap the Inventory module worked around). */
  tableId?: Types.ObjectId;
  status: ReservationStatus;
  notes?: string;
  createdByStaffId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<ReservationDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    guestName: { type: String, required: true, trim: true },
    guestPhone: { type: String, required: true, trim: true },
    partySize: { type: Number, required: true, min: 1 },
    reservationTime: { type: Date, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table" },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      required: true,
      default: "confirmed",
    },
    notes: { type: String, trim: true },
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Required compound index (PRD §5.4 pattern) — powers the date-navigator
// list query (`GET /api/reservations?date=...`), which is the screen's
// primary read pattern.
reservationSchema.index({ restaurantId: 1, reservationTime: 1 });
reservationSchema.index({ restaurantId: 1, status: 1 });
reservationSchema.index({ restaurantId: 1, tableId: 1 });

export const Reservation = model<ReservationDocument>("Reservation", reservationSchema);
