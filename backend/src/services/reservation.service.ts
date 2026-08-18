import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Table } from "../models/table.model";
import { Order } from "../models/order.model";
import { ACTIVE_ORDER_STATUSES } from "./order.service";
import {
  Reservation,
  type ReservationDocument,
  type ReservationStatus,
} from "../models/reservation.model";
import * as tableService from "./table.service";

export interface ReservationDto {
  id: string;
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: Date;
  tableId?: string;
  status: ReservationStatus;
  notes?: string;
  createdByStaffId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Statuses in which a reservation is actively "claiming" its table — see
 * the table-hold design note above `createReservation`. `seated` is
 * deliberately excluded: once seated, the hold on `Table.status` becomes
 * `occupied` (driven by `seatReservation`, reusing the same table row an
 * order would occupy), not `reserved`, so it's tracked separately rather
 * than through this list.
 */
const HOLD_STATUSES: ReservationStatus[] = ["confirmed", "waitlist"];

// Statuses a reservation can never move away from without a brand-new
// reservation record — matches `updateReservation`'s edit gate below.
const TERMINAL_STATUSES: ReservationStatus[] = ["seated", "no_show", "cancelled"];

function toDto(reservation: HydratedDocument<ReservationDocument>): ReservationDto {
  return {
    id: reservation._id.toString(),
    restaurantId: reservation.restaurantId.toString(),
    guestName: reservation.guestName,
    guestPhone: reservation.guestPhone,
    partySize: reservation.partySize,
    reservationTime: reservation.reservationTime,
    tableId: reservation.tableId?.toString(),
    status: reservation.status,
    notes: reservation.notes,
    createdByStaffId: reservation.createdByStaffId.toString(),
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

async function findReservationOrThrow(
  restaurantId: string,
  reservationId: string,
): Promise<HydratedDocument<ReservationDocument>> {
  if (!Types.ObjectId.isValid(reservationId)) {
    throw new AppError("Reservation not found.", 404, "NOT_FOUND");
  }
  const reservation = await Reservation.findOne({ _id: reservationId, restaurantId });
  if (!reservation) {
    throw new AppError("Reservation not found.", 404, "NOT_FOUND");
  }
  return reservation;
}

/**
 * Confirms `tableId` is free to be put on hold for a reservation — rejects
 * with a clear error if the table already has a live order, or is already
 * held by a *different* reservation. `excludeReservationId` lets an update
 * to the same reservation re-check without tripping over its own existing
 * hold.
 */
async function assertTableAvailableForHold(
  restaurantId: string,
  tableId: string,
  excludeReservationId?: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(tableId)) {
    throw new AppError("Selected table does not exist.", 400, "TABLE_NOT_FOUND");
  }
  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (!table) {
    throw new AppError("Selected table does not exist.", 400, "TABLE_NOT_FOUND");
  }

  const hasActiveOrder = await Order.exists({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_ORDER_STATUSES },
  });
  if (hasActiveOrder) {
    throw new AppError(
      "This table already has an active order and can't be reserved.",
      409,
      "TABLE_HAS_ACTIVE_ORDER",
    );
  }

  const conflictingReservation = await Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: [...HOLD_STATUSES, "seated"] },
    ...(excludeReservationId ? { _id: { $ne: excludeReservationId } } : {}),
  });
  if (conflictingReservation) {
    throw new AppError(
      "This table is already held by another reservation.",
      409,
      "TABLE_ALREADY_RESERVED",
    );
  }
}

/** Puts a table on hold for a reservation — reuses `tableService.updateTableStatus`
 * (the one status-mutation path every module shares) rather than writing to
 * `Table` directly. */
async function applyTableHold(restaurantId: string, tableId: string): Promise<void> {
  await tableService.updateTableStatus(restaurantId, tableId, "reserved");
}

/**
 * Releases a table's `reserved` hold back to `free` — but only if nothing
 * else still needs it: no active order (same `ACTIVE_ORDER_STATUSES` check
 * `order.service.ts` uses before force-freeing a table on void) and no
 * other reservation still holding it. Only touches the table if it's
 * currently `reserved`, so it never clobbers `occupied`/`needs_cleaning`
 * set by something unrelated.
 */
async function releaseTableHoldIfIdle(restaurantId: string, tableId: string): Promise<void> {
  const hasActiveOrder = await Order.exists({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_ORDER_STATUSES },
  });
  if (hasActiveOrder) return;

  const stillHeldByAnother = await Reservation.exists({
    restaurantId,
    tableId,
    status: { $in: HOLD_STATUSES },
  });
  if (stillHeldByAnother) return;

  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (table && table.status === "reserved") {
    await tableService.updateTableStatus(restaurantId, tableId, "free");
  }
}

/**
 * Table-hold design note (PRD §3.7 "Auto table-hold logic: reserved tables
 * blocked ... at reservation time ± buffer window"): there is no job
 * scheduler (cron/BullMQ) wired up in this codebase yet, so a true
 * time-window hold (release the table automatically N minutes after the
 * reservation slot if the guest never shows) isn't implemented here — same
 * gap the Inventory module's deduction logic worked around by picking a
 * concrete trigger instead of a time-based one. This module follows that
 * precedent: the hold is **event-triggered**, keyed off explicit staff
 * actions —
 *   - assigning a table to a `confirmed`/`waitlist` reservation -> `reserved`
 *   - `PATCH /:id/seat` -> `occupied`
 *   - cancel / no-show / un-assigning the table -> `free` (if idle)
 * The buffer-window behavior (auto-release an unconfirmed no-show after a
 * grace period) is a documented Phase-3 follow-up once a job scheduler
 * exists in this codebase — it is out of scope for this build.
 */
export async function createReservation(
  restaurantId: string,
  staffId: string,
  input: {
    guestName: string;
    guestPhone: string;
    partySize: number;
    reservationTime: string;
    tableId?: string;
    status?: ReservationStatus;
    notes?: string;
  },
): Promise<ReservationDto> {
  const status = input.status ?? "confirmed";

  if (input.tableId) {
    await assertTableAvailableForHold(restaurantId, input.tableId);
  }

  const reservation = await Reservation.create({
    restaurantId,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    partySize: input.partySize,
    reservationTime: new Date(input.reservationTime),
    tableId: input.tableId,
    status,
    notes: input.notes,
    createdByStaffId: staffId,
  });

  if (input.tableId && HOLD_STATUSES.includes(status)) {
    await applyTableHold(restaurantId, input.tableId);
  }

  return toDto(reservation);
}

export async function listReservations(
  restaurantId: string,
  filters: { date?: string; status?: ReservationStatus },
): Promise<ReservationDto[]> {
  const query: Record<string, unknown> = { restaurantId };

  if (filters.date) {
    // `date` is a plain `YYYY-MM-DD` (validated in
    // `reservation.validators.ts`) — filters to that single calendar day in
    // the server process's local time zone, same "single-site self-hosted"
    // assumption `utils/date-range.ts` documents for Reports.
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    query.reservationTime = { $gte: start, $lte: end };
  }
  if (filters.status) {
    query.status = filters.status;
  }

  const reservations = await Reservation.find(query).sort({ reservationTime: 1 });
  return reservations.map(toDto);
}

export async function getReservation(
  restaurantId: string,
  reservationId: string,
): Promise<ReservationDto> {
  const reservation = await findReservationOrThrow(restaurantId, reservationId);
  return toDto(reservation);
}

/**
 * General edit — guest details, party size, time, notes, table assignment,
 * and status among `confirmed`/`waitlist`/`no_show`/`cancelled` (validated
 * in `reservation.validators.ts`; `seated` is deliberately not a reachable
 * value here — that transition only happens through `seatReservation`,
 * which also has to move the table to `occupied`). Once a reservation
 * reaches a terminal status (`seated`/`no_show`/`cancelled`) it can no
 * longer be edited through this path — start a new reservation instead.
 */
export async function updateReservation(
  restaurantId: string,
  reservationId: string,
  input: {
    guestName?: string;
    guestPhone?: string;
    partySize?: number;
    reservationTime?: string;
    tableId?: string | null;
    status?: ReservationStatus;
    notes?: string;
  },
): Promise<ReservationDto> {
  const reservation = await findReservationOrThrow(restaurantId, reservationId);

  if (TERMINAL_STATUSES.includes(reservation.status)) {
    throw new AppError(
      "This reservation is no longer active and can't be edited.",
      400,
      "RESERVATION_NOT_EDITABLE",
    );
  }

  const previousTableId = reservation.tableId?.toString();
  const previousStatus = reservation.status;

  const tableIdProvided = Object.prototype.hasOwnProperty.call(input, "tableId");
  const nextTableId = tableIdProvided ? (input.tableId ?? undefined) : previousTableId;
  const nextStatus = input.status ?? previousStatus;

  // Only re-check availability when the table assignment is actually
  // changing to a new table — moving/removing a reservation's own
  // already-held table never needs to "compete" with itself.
  if (nextTableId && nextTableId !== previousTableId) {
    await assertTableAvailableForHold(restaurantId, nextTableId, reservationId);
  }

  if (input.guestName !== undefined) reservation.guestName = input.guestName;
  if (input.guestPhone !== undefined) reservation.guestPhone = input.guestPhone;
  if (input.partySize !== undefined) reservation.partySize = input.partySize;
  if (input.reservationTime !== undefined) {
    reservation.reservationTime = new Date(input.reservationTime);
  }
  if (tableIdProvided) {
    reservation.tableId = nextTableId ? new Types.ObjectId(nextTableId) : undefined;
  }
  if (input.status !== undefined) reservation.status = input.status;
  if (input.notes !== undefined) reservation.notes = input.notes;

  await reservation.save();

  const previousHeld = !!previousTableId && HOLD_STATUSES.includes(previousStatus);
  const nextHeld = !!nextTableId && HOLD_STATUSES.includes(nextStatus);

  if (previousHeld && (!nextHeld || previousTableId !== nextTableId)) {
    await releaseTableHoldIfIdle(restaurantId, previousTableId!);
  }
  if (nextHeld && (!previousHeld || previousTableId !== nextTableId)) {
    await applyTableHold(restaurantId, nextTableId!);
  }

  return toDto(reservation);
}

/**
 * Hard-deletes a reservation record (e.g. entered by mistake) and releases
 * its table hold the same way cancelling would.
 */
export async function deleteReservation(restaurantId: string, reservationId: string): Promise<void> {
  const reservation = await findReservationOrThrow(restaurantId, reservationId);
  const tableId = reservation.tableId?.toString();
  const wasHeld = !!tableId && HOLD_STATUSES.includes(reservation.status);

  await reservation.deleteOne();

  if (wasHeld && tableId) {
    await releaseTableHoldIfIdle(restaurantId, tableId);
  }
}

/**
 * `PATCH /:id/seat` — the one place a reservation moves to `seated` and its
 * table moves to `occupied`. Deliberately does not create an Order: seating
 * a party and starting their order are two separate real actions in this
 * app (floor staff opens New Order from the Tables screen afterward, same
 * as any walk-in) — see the module-level doc comment above
 * `createReservation`.
 */
export async function seatReservation(
  restaurantId: string,
  reservationId: string,
  input: { tableId?: string },
): Promise<ReservationDto> {
  const reservation = await findReservationOrThrow(restaurantId, reservationId);

  if (reservation.status !== "confirmed" && reservation.status !== "waitlist") {
    throw new AppError(
      "Only a confirmed or waitlisted reservation can be seated.",
      400,
      "RESERVATION_NOT_SEATABLE",
    );
  }

  const previousTableId = reservation.tableId?.toString();
  const tableId = input.tableId ?? previousTableId;
  if (!tableId) {
    throw new AppError("Assign a table before seating this reservation.", 400, "TABLE_REQUIRED");
  }

  if (tableId !== previousTableId) {
    // Assigning a different/new table at seat time — same availability
    // check as any other table assignment.
    await assertTableAvailableForHold(restaurantId, tableId, reservationId);
  } else {
    // Re-confirm the already-held table hasn't picked up an active order
    // between hold time and seat time (defensive — table state can change
    // independently of the reservation).
    const hasActiveOrder = await Order.exists({
      restaurantId,
      tableId,
      status: { $in: ACTIVE_ORDER_STATUSES },
    });
    if (hasActiveOrder) {
      throw new AppError(
        "This table already has an active order and can't be seated.",
        409,
        "TABLE_HAS_ACTIVE_ORDER",
      );
    }
  }

  reservation.status = "seated";
  reservation.tableId = new Types.ObjectId(tableId);
  await reservation.save();

  if (previousTableId && previousTableId !== tableId) {
    await releaseTableHoldIfIdle(restaurantId, previousTableId);
  }
  // Reuses the shared table-status service, same as every other module —
  // this also emits the `table:status-changed` socket event the Tables
  // screen already listens for, so seating a reservation shows up live.
  await tableService.updateTableStatus(restaurantId, tableId, "occupied");

  return toDto(reservation);
}
