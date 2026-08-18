"use client";

import { useState } from "react";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import type { DiscountApprovalThreshold, DiscountType } from "@/lib/settings/types";

/**
 * Discount approval threshold (PRD §3.10 "manager-approval lock for
 * discounts above a configurable threshold"). Read by
 * `invoice.service.ts` `discountExceedsThreshold` on every bill — a
 * discount at or below this line can be applied by any billing role, above
 * it requires a manager/owner's credentials at settle time.
 */
export function DiscountPolicyForm({
  threshold,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  threshold: DiscountApprovalThreshold;
  onSubmit: (threshold: DiscountApprovalThreshold) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [type, setType] = useState<DiscountType>(threshold.type);
  const [value, setValue] = useState(
    threshold.type === "flat" ? paiseToRupeesInput(threshold.value) : String(threshold.value),
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Discount Policy</h2>
      <p className="mt-1 text-small text-text-muted">
        Discounts above this threshold need a manager or owner to confirm at settle time.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const numeric = Number(value);
          onSubmit({
            type,
            value: type === "flat" ? rupeesToPaise(numeric) : numeric,
          });
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Threshold type</span>
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as DiscountType;
              // Reset the value across unit changes rather than silently
              // reinterpreting a rupee amount as a percent (or vice versa).
              setValue(nextType === "percent" ? "15" : "0.00");
              setType(nextType);
            }}
            className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="percent">Percent of bill</option>
            <option value="flat">Flat amount</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">
            {type === "percent" ? "Threshold (%)" : "Threshold (₹)"}
          </span>
          <input
            type="number"
            min={0}
            max={type === "percent" ? 100 : undefined}
            step={type === "percent" ? 1 : 0.01}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            className="w-32 rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || value.trim() === ""}
          className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save Discount Policy"}
        </button>
      </form>

      {errorMessage && <p className="mt-2 text-small text-error">{errorMessage}</p>}
      {successMessage && <p className="mt-2 text-small text-success">{successMessage}</p>}
    </section>
  );
}
