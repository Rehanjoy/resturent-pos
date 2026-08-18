"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Area, RestaurantTable } from "@/lib/tables/types";
import type { Reservation } from "@/lib/reservations/types";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/reservations/date";
import { TableSelect } from "./table-select";

export interface ReservationFormValues {
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: string;
  tableId?: string;
  notes?: string;
  /** Only present/used in edit mode — a guest can be moved between
   * confirmed and waitlist here; cancel/no-show/seat are separate card
   * actions, not this form (see `reservation.service.ts` for why `seated`
   * is never reachable through the general edit). */
  status?: "confirmed" | "waitlist";
}

/**
 * "New reservation" / "Edit reservation" modal — guest name, phone, party
 * size, date/time, and a table dropdown grouped by area, per the client's
 * reference screenshot.
 */
export function ReservationFormModal({
  reservation,
  defaultDate,
  tables,
  areas,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  reservation: Reservation | null;
  /** `YYYY-MM-DD` — the currently viewed date on the screen, used to seed a
   * sensible default reservation time for a brand-new reservation. */
  defaultDate: string;
  tables: RestaurantTable[];
  areas: Area[];
  onClose: () => void;
  onSubmit: (input: ReservationFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [guestName, setGuestName] = useState(reservation?.guestName ?? "");
  const [guestPhone, setGuestPhone] = useState(reservation?.guestPhone ?? "");
  const [partySize, setPartySize] = useState(reservation ? String(reservation.partySize) : "2");
  const [reservationTime, setReservationTime] = useState(
    reservation
      ? isoToDatetimeLocalValue(reservation.reservationTime)
      : `${defaultDate}T19:00`,
  );
  const [tableId, setTableId] = useState(reservation?.tableId ?? "");
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [status, setStatus] = useState<"confirmed" | "waitlist">(
    reservation?.status === "waitlist" ? "waitlist" : "confirmed",
  );

  const isValid = guestName.trim() && guestPhone.trim() && Number(partySize) > 0 && reservationTime;

  return (
    <Modal title={reservation ? "Edit Reservation" : "New Reservation"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          onSubmit({
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim(),
            partySize: Number(partySize),
            reservationTime: datetimeLocalValueToIso(reservationTime),
            tableId: tableId || undefined,
            notes: notes.trim() || undefined,
            ...(reservation ? { status } : {}),
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Guest name</span>
          <input
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            required
            placeholder="e.g. Priya Sharma"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Phone</span>
          <input
            value={guestPhone}
            onChange={(event) => setGuestPhone(event.target.value)}
            required
            placeholder="e.g. 98765 43210"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Party size</span>
            <input
              type="number"
              min={1}
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              required
              className="rounded-md border border-border px-3 py-2 text-body text-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Date &amp; time</span>
            <input
              type="datetime-local"
              value={reservationTime}
              onChange={(event) => setReservationTime(event.target.value)}
              required
              className="rounded-md border border-border px-3 py-2 text-body text-text"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Table (optional)</span>
          <TableSelect tables={tables} areas={areas} value={tableId} onChange={setTableId} />
        </label>

        {reservation && (
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "confirmed" | "waitlist")}
              className="rounded-md border border-border px-3 py-2 text-body text-text"
            >
              <option value="confirmed">Confirmed</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Note (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="e.g. Anniversary — window seat requested"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
