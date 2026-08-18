"use client";

import { useState } from "react";
import type { TaxConfigEntry, TaxType } from "@/lib/settings/types";

const TAX_TYPES: TaxType[] = ["CGST", "SGST", "VAT", "other"];

let nextRowId = 0;
interface TaxRow {
  id: number;
  name: string;
  ratePercent: string;
  type: TaxType;
}

function toRows(taxConfig: TaxConfigEntry[]): TaxRow[] {
  return taxConfig.map((entry) => ({
    id: nextRowId++,
    name: entry.name,
    ratePercent: String(entry.ratePercent),
    type: entry.type,
  }));
}

/**
 * Tax slab configuration (PRD §3.14) — this is exactly what powers the
 * CGST/SGST lines shown on the Settle Bill screen's `TaxSummary`
 * (`invoice.service.ts` reads `Restaurant.taxConfig` when generating a new
 * bill). Changes here apply to the next bill generated, never retroactively
 * — issued invoices are immutable.
 */
export function TaxConfigForm({
  taxConfig,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  taxConfig: TaxConfigEntry[];
  onSubmit: (taxConfig: TaxConfigEntry[]) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [rows, setRows] = useState<TaxRow[]>(() => toRows(taxConfig));

  function updateRow(id: number, patch: Partial<TaxRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { id: nextRowId++, name: "", ratePercent: "0", type: "other" }]);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  const isValid = rows.every((row) => row.name.trim().length > 0 && Number.isFinite(Number(row.ratePercent)));

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Tax Configuration</h2>
      <p className="mt-1 text-small text-text-muted">
        Add every tax slab that applies to a bill (e.g. CGST 2.5% + SGST 2.5%). Each slab is
        applied to the post-discount subtotal.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(
            rows.map((row) => ({
              name: row.name.trim(),
              ratePercent: Number(row.ratePercent),
              type: row.type,
            })),
          );
        }}
        className="mt-4 flex flex-col gap-3"
      >
        {rows.length === 0 && (
          <p className="text-small text-text-muted">No tax slabs configured — bills will show ₹0 tax.</p>
        )}

        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-2">
            <input
              value={row.name}
              onChange={(event) => updateRow(row.id, { name: event.target.value })}
              placeholder="e.g. CGST"
              required
              className="w-32 rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={row.type}
              onChange={(event) => updateRow(row.id, { type: event.target.value as TaxType })}
              className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {TAX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={row.ratePercent}
                onChange={(event) => updateRow(row.id, { ratePercent: event.target.value })}
                required
                className="w-24 rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-small text-text-muted">%</span>
            </div>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="text-small text-error hover:underline"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="self-start text-small text-secondary hover:underline"
        >
          + Add tax slab
        </button>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save Tax Configuration"}
          </button>
        </div>
      </form>
    </section>
  );
}
