"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { addDaysToDateString, formatDateHeading, todayLocalDateString } from "@/lib/reservations/date";

/**
 * Prev/next arrows + native date picker + "Today"/"Tomorrow" quick buttons,
 * per the client's reference screenshot. `summary` renders the
 * "N bookings · M covers" line the reference shows directly under the
 * navigator — passed in rather than computed here so this component stays
 * a pure date-selection control.
 */
export function DateNavigator({
  date,
  onChange,
  summary,
}: {
  date: string;
  onChange: (date: string) => void;
  summary: React.ReactNode;
}) {
  const today = todayLocalDateString();
  const tomorrow = addDaysToDateString(today, 1);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(addDaysToDateString(date, -1))}
          aria-label="Previous day"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:text-text"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <div className="flex flex-col">
          <span className="font-heading text-base font-semibold text-text">
            {formatDateHeading(date)}
          </span>
          {summary}
        </div>

        <button
          type="button"
          onClick={() => onChange(addDaysToDateString(date, 1))}
          aria-label="Next day"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:text-text"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(today)}
          className={`rounded-full px-3.5 py-1.5 text-small font-medium transition-colors ${
            date === today
              ? "border border-primary text-primary"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onChange(tomorrow)}
          className={`rounded-full px-3.5 py-1.5 text-small font-medium transition-colors ${
            date === tomorrow
              ? "border border-primary text-primary"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          Tomorrow
        </button>
        <input
          type="date"
          value={date}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          aria-label="Choose a date"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-small text-text"
        />
      </div>
    </div>
  );
}
