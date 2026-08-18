import { z } from "zod";
import { REPORT_RANGES } from "../utils/date-range";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format (e.g. 2026-08-18).");

/** Shared between `reportRangeQuerySchema` and `exportReportQuerySchema` —
 * both require `from`/`to` only when `range` is `"custom"`. */
function requiresCustomBounds(query: { range: string; from?: string; to?: string }): boolean {
  return query.range !== "custom" || (!!query.from && !!query.to);
}

export const reportRangeQuerySchema = z
  .object({
    range: z.enum(REPORT_RANGES),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .refine(requiresCustomBounds, {
    message: "Custom range requires both from and to dates.",
    path: ["from"],
  });

export const exportReportQuerySchema = z
  .object({
    range: z.enum(REPORT_RANGES),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    report: z.enum(["sales", "top-dishes"]),
    format: z.enum(["csv"]),
  })
  .refine(requiresCustomBounds, {
    message: "Custom range requires both from and to dates.",
    path: ["from"],
  });
