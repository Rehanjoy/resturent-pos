"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Area, RestaurantTable } from "@/lib/tables/types";
import type { Reservation } from "@/lib/reservations/types";
import { TableSelect } from "./table-select";

/**
 * Confirms which table to seat a reservation at. Pre-fills the
 * reservation's already-held table if it has one (the common case — the
 * table was picked at booking time); otherwise requires staff to pick one
 * now, matching the backend's `TABLE_REQUIRED` rule in
 * `reservation.service.ts` `seatReservation`.
 */
export function SeatReservationModal({
  reservation,
  tables,
  areas,
  onClose,
  onConfirm,
  isSubmitting,
  errorMessage,
}: {
  reservation: Reservation;
  tables: RestaurantTable[];
  areas: Area[];
  onClose: () => void;
  onConfirm: (tableId: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [tableId, setTableId] = useState(reservation.tableId ?? "");

  return (
    <Modal title={`Seat ${reservation.guestName}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!tableId) return;
          onConfirm(tableId);
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-small text-text-muted">
          Party of {reservation.partySize}. Confirm the table to seat them at.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Table</span>
          <TableSelect
            tables={tables}
            areas={areas}
            value={tableId}
            onChange={setTableId}
            allowNone={false}
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
            disabled={isSubmitting || !tableId}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Seating…" : "Seat"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
