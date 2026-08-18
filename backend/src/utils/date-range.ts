import { AppError } from "./app-error";

export const REPORT_RANGES = ["today", "yesterday", "7d", "month", "custom"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface DateRangeBounds {
  from: Date;
  to: Date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/**
 * Single source of truth for turning a `range` (+ optional `from`/`to` for
 * `custom`) query param into concrete Date bounds — reused by the Dashboard
 * (always `"today"`/`"7d"`) and every one of the four Reports endpoints
 * (PRD §3.12 "Filters: Today / Yesterday / Last 7 days / This Month /
 * Custom range") instead of duplicating this logic per endpoint.
 *
 * `to` is always the end of its calendar day so a single-day range still
 * captures every record created any time that day. Bounds are computed in
 * the server process's local time zone — acceptable for this MVP's
 * single-site, self-hosted deployment model (PRD "Deployment Model");
 * multi-timezone support is a documented follow-up, not attempted here.
 */
export function resolveDateRange(range: ReportRange, from?: string, to?: string): DateRangeBounds {
  const now = new Date();

  switch (range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };

    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }

    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6); // last 7 calendar days, inclusive of today
      return { from: startOfDay(start), to: endOfDay(now) };
    }

    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(now) };
    }

    case "custom": {
      if (!from || !to) {
        throw new AppError("Custom range requires both from and to dates.", 400, "VALIDATION_ERROR");
      }
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw new AppError("Enter valid from/to dates.", 400, "VALIDATION_ERROR");
      }
      if (fromDate > toDate) {
        throw new AppError("The from date must be before the to date.", 400, "VALIDATION_ERROR");
      }
      return { from: startOfDay(fromDate), to: endOfDay(toDate) };
    }

    default:
      throw new AppError("Invalid range.", 400, "VALIDATION_ERROR");
  }
}
