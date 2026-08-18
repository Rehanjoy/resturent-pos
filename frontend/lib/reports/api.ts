import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token-store";
import type {
  ReportRangeParams,
  SalesReport,
  StaffPerformanceReport,
  TopDishesReport,
} from "./types";

// Mirrors `lib/billing/api.ts`'s PDF-download approach — the CSV export
// needs a raw `fetch` (not the JSON-only `api` client) so it can read a
// plain-text response body, but still has to attach the same auth header.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

function toQueryString(params: ReportRangeParams): string {
  const search = new URLSearchParams({ range: params.range });
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return search.toString();
}

export const reportsApi = {
  getSalesReport: (params: ReportRangeParams) =>
    api.get<{ report: SalesReport }>(`/api/reports/sales?${toQueryString(params)}`),

  getTopDishesReport: (params: ReportRangeParams) =>
    api.get<{ report: TopDishesReport }>(`/api/reports/top-dishes?${toQueryString(params)}`),

  getStaffPerformanceReport: (params: ReportRangeParams) =>
    api.get<{ report: StaffPerformanceReport }>(
      `/api/reports/staff-performance?${toQueryString(params)}`,
    ),

  /** Downloads a CSV export as a Blob, filename read back from the
   * `Content-Disposition` header the backend sets. */
  exportCsv: async (
    reportType: "sales" | "top-dishes",
    params: ReportRangeParams,
  ): Promise<{ blob: Blob; filename: string }> => {
    const token = getAccessToken();
    const search = toQueryString(params);
    const response = await fetch(
      `${API_BASE_URL}/api/reports/export?${search}&report=${reportType}&format=csv`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new ApiError(
        "Could not export this report. Check your connection and try again.",
        response.status,
        "REPORT_EXPORT_ERROR",
      );
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `${reportType}-report.csv`;
    return { blob: await response.blob(), filename };
  },
};
