/**
 * Local-calendar-day helpers for the Reservations date navigator. Built
 * from `Date`'s local getters (never `toISOString()`, which is UTC) so the
 * `YYYY-MM-DD` string sent as the `date` query param lines up with how
 * `backend/src/services/reservation.service.ts` `listReservations`
 * interprets it — the server process's local time zone (same "single-site
 * self-hosted" assumption `utils/date-range.ts` documents for Reports).
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year!, (month ?? 1) - 1, day);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/** `datetime-local` input value ("YYYY-MM-DDTHH:mm") from an ISO string, in
 * local time — the browser input's native format. */
export function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Inverse of `isoToDatetimeLocalValue` — a `datetime-local` input's raw
 * value, interpreted as local time, back to an ISO string for the API. */
export function datetimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString();
}

export function formatDateHeading(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year!, (month ?? 1) - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatReservationTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
