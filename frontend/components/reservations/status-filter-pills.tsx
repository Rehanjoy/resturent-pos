"use client";

import type { ReservationStatus } from "@/lib/reservations/types";

export type StatusFilter = ReservationStatus | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "waitlist", label: "Waitlist" },
  { value: "seated", label: "Seated" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

export function StatusFilterPills({
  value,
  onChange,
  countByStatus,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  /** Optional per-status counts (from the day's full reservation list) —
   * shown next to each pill label when provided. */
  countByStatus?: Partial<Record<StatusFilter, number>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
            value === filter.value
              ? "border border-primary text-primary"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          {filter.label}
          {countByStatus?.[filter.value] !== undefined && (
            <span className="ml-1 text-text-muted">{countByStatus[filter.value]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
