"use client";

import { useState } from "react";
import { reportsApi } from "@/lib/reports/api";
import type { ReportRangeParams } from "@/lib/reports/types";

/** Triggers a CSV download — mirrors the PDF-download pattern in
 * `components/billing/settlement-confirmation.tsx`. */
export function ExportButton({
  reportType,
  params,
}: {
  reportType: "sales" | "top-dishes";
  params: ReportRangeParams;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setIsExporting(true);
    try {
      const { blob, filename } = await reportsApi.exportCsv(reportType, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export this report. Check your connection and try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-small font-medium text-text shadow-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {isExporting ? "Exporting…" : "Export CSV"}
      </button>
      {error && <p className="text-small text-error">{error}</p>}
    </div>
  );
}
