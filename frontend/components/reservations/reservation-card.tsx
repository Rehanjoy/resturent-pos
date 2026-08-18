"use client";

import { ChairIcon, PhoneIcon } from "@/components/icons";
import { formatReservationTime } from "@/lib/reservations/date";
import type { Reservation, ReservationStatus } from "@/lib/reservations/types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmed: "Confirmed",
  waitlist: "Waitlist",
  seated: "Seated",
  no_show: "No-show",
  cancelled: "Cancelled",
};

// Semantic tokens from docs/02-brand-kit.md — confirmed reads as the
// "locked-in, good to go" state (success), waitlist as pending/uncertain
// (warning), seated as in-progress (primary/brand), no-show/cancelled as
// the two "didn't happen" outcomes (error/muted).
const STATUS_BADGE: Record<ReservationStatus, string> = {
  confirmed: "bg-success/10 text-success",
  waitlist: "bg-warning/10 text-warning",
  seated: "bg-primary/10 text-primary",
  no_show: "bg-error/10 text-error",
  cancelled: "bg-border text-text-muted",
};

const UPCOMING_STATUSES: ReservationStatus[] = ["confirmed", "waitlist"];

export function ReservationCard({
  reservation,
  tableName,
  canManage,
  onSeat,
  onEdit,
  onCancel,
  onNoShow,
  onDelete,
}: {
  reservation: Reservation;
  tableName?: string;
  canManage: boolean;
  onSeat: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}) {
  const isUpcoming = UPCOMING_STATUSES.includes(reservation.status);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="w-16 shrink-0 text-center">
          <p className="font-heading text-base font-semibold text-text">
            {formatReservationTime(reservation.reservationTime)}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-heading text-base font-semibold text-text">
              {reservation.guestName}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[reservation.status]}`}
            >
              {STATUS_LABEL[reservation.status]}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-text-muted">
            <span className="flex items-center gap-1">
              <ChairIcon className="h-3.5 w-3.5" />
              {reservation.partySize}
            </span>
            {tableName && <span>{tableName}</span>}
            <span className="flex items-center gap-1">
              <PhoneIcon className="h-3.5 w-3.5" />
              {reservation.guestPhone}
            </span>
          </div>

          {reservation.notes && (
            <p className="mt-1 text-small italic text-text-muted">&ldquo;{reservation.notes}&rdquo;</p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {isUpcoming && (
            <>
              <button
                type="button"
                onClick={() => onSeat(reservation)}
                className="rounded-lg bg-accent px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary"
              >
                Seat
              </button>
              <button
                type="button"
                onClick={() => onEdit(reservation)}
                className="text-small font-medium text-text-muted hover:text-secondary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onNoShow(reservation)}
                className="text-small font-medium text-text-muted hover:text-warning"
              >
                No-show
              </button>
              <button
                type="button"
                onClick={() => onCancel(reservation)}
                className="text-small font-medium text-text-muted hover:text-error"
              >
                Cancel
              </button>
            </>
          )}
          {!isUpcoming && (
            <button
              type="button"
              onClick={() => onDelete(reservation)}
              className="text-small font-medium text-text-muted hover:text-error"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
