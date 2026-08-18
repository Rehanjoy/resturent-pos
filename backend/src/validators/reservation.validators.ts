import { z } from "zod";
import { RESERVATION_STATUSES } from "../models/reservation.model";

// Statuses a reservation can be *created* with — never `seated`/`no_show`/
// `cancelled` at creation time; those are transitions on an existing
// reservation (`seated` via `PATCH /:id/seat`, the other two via
// `PATCH /:id`).
const CREATE_STATUSES = ["confirmed", "waitlist"] as const;

// Statuses reachable through the general `PATCH /:id` edit — deliberately
// excludes `seated`, which only happens through the dedicated
// `PATCH /:id/seat` endpoint (see `reservation.service.ts`).
const EDITABLE_STATUSES = ["confirmed", "waitlist", "no_show", "cancelled"] as const;

const reservationTimeSchema = z
  .string()
  .min(1, "Reservation date/time is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date/time.");

export const createReservationSchema = z.object({
  guestName: z.string().trim().min(1, "Guest name is required.").max(120),
  guestPhone: z.string().trim().min(1, "Guest phone is required.").max(30),
  partySize: z
    .number()
    .int("Party size must be a whole number.")
    .min(1, "Party size must be at least 1."),
  reservationTime: reservationTimeSchema,
  tableId: z.string().min(1).optional(),
  status: z.enum(CREATE_STATUSES).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateReservationSchema = z.object({
  guestName: z.string().trim().min(1).max(120).optional(),
  guestPhone: z.string().trim().min(1).max(30).optional(),
  partySize: z.number().int().min(1).optional(),
  reservationTime: reservationTimeSchema.optional(),
  // `null` explicitly un-assigns the table (releases the hold);
  // `undefined`/omitted leaves the current assignment untouched.
  tableId: z.string().min(1).nullable().optional(),
  status: z.enum(EDITABLE_STATUSES).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const seatReservationSchema = z.object({
  // Optional — lets staff assign a table at the moment of seating if one
  // wasn't picked when the reservation was made.
  tableId: z.string().min(1).optional(),
});

export const reservationIdParamsSchema = z.object({
  id: z.string().min(1, "Reservation id is required."),
});

export const reservationListQuerySchema = z.object({
  // Plain `YYYY-MM-DD` — filters to a single calendar day, matching the
  // date-navigator UX on the Reservations screen.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format (e.g. 2026-08-18).")
    .optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
});
