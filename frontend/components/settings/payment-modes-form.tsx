"use client";

import { useState } from "react";
import type { PaymentMode } from "@/lib/settings/types";

const PAYMENT_MODE_OPTIONS: { mode: PaymentMode; label: string }[] = [
  { mode: "cash", label: "Cash" },
  { mode: "card", label: "Card" },
  { mode: "upi", label: "UPI" },
];

/**
 * Payment mode toggles (PRD §3.14). The Settle Bill screen's
 * `PaymentPanel` now reads this list to decide which mode buttons to show
 * (see `frontend/components/billing/payment-panel.tsx`), so this is
 * enforced on the billing UI, not just stored.
 */
export function PaymentModesForm({
  enabledPaymentModes,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  enabledPaymentModes: PaymentMode[];
  onSubmit: (modes: PaymentMode[]) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [selected, setSelected] = useState<Set<PaymentMode>>(new Set(enabledPaymentModes));

  function toggle(mode: PaymentMode) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(mode)) {
        next.delete(mode);
      } else {
        next.add(mode);
      }
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Payment Modes</h2>
      <p className="mt-1 text-small text-text-muted">
        Only enabled modes appear on the Settle Bill screen&apos;s payment selector.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(PAYMENT_MODE_OPTIONS.map((option) => option.mode).filter((mode) => selected.has(mode)));
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <div className="flex gap-6">
          {PAYMENT_MODE_OPTIONS.map((option) => (
            <label key={option.mode} className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={selected.has(option.mode)}
                onChange={() => toggle(option.mode)}
                className="h-4 w-4 rounded border-border"
              />
              {option.label}
            </label>
          ))}
        </div>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || selected.size === 0}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save Payment Modes"}
          </button>
        </div>
      </form>
    </section>
  );
}
