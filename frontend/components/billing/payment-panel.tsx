"use client";

import { useState } from "react";
import { formatMoney, paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import type { PaymentMode } from "@/lib/billing/types";
import { CardIcon, CashIcon, type IconProps, UpiIcon } from "@/components/icons";

const PAYMENT_MODE_OPTIONS: { mode: PaymentMode; label: string; icon: (props: IconProps) => React.ReactElement }[] = [
  { mode: "cash", label: "Cash", icon: CashIcon },
  { mode: "card", label: "Card", icon: CardIcon },
  { mode: "upi", label: "UPI", icon: UpiIcon },
];

let nextLineId = 0;
interface PaymentLine {
  id: number;
  mode: PaymentMode;
  amount: string; // rupees, as typed
}

/**
 * Payment method selector with split-payment support (PRD §3.10
 * "Cash / Card / UPI / Split-payment across modes"). Each line is one
 * `{mode, amount}` pair; the backend requires the sum to equal
 * `invoice.total` exactly (`payment.service.ts`) — this component enforces
 * the same rule client-side so "Settle Bill" only becomes enabled once the
 * split actually balances, but the server is still the source of truth.
 */
export function PaymentPanel({
  total,
  enabledModes,
  onSettle,
  isSettling,
  errorMessage,
}: {
  total: number;
  /** Which modes the Settings module (PRD §3.14) has enabled for this
   * restaurant. Defaults to all three so this component still works if a
   * caller doesn't have settings loaded yet. */
  enabledModes?: PaymentMode[];
  onSettle: (payments: { mode: PaymentMode; amount: number }[]) => void;
  isSettling: boolean;
  errorMessage: string | null;
}) {
  const modeOptions = PAYMENT_MODE_OPTIONS.filter(
    (option) => !enabledModes || enabledModes.includes(option.mode),
  );
  const defaultMode = modeOptions[0]?.mode ?? "cash";

  const [lines, setLines] = useState<PaymentLine[]>([
    { id: nextLineId++, mode: defaultMode, amount: paiseToRupeesInput(total) },
  ]);

  const paise = lines.map((line) => {
    const value = Number(line.amount);
    return Number.isFinite(value) && value > 0 ? rupeesToPaise(value) : 0;
  });
  const sum = paise.reduce((a, b) => a + b, 0);
  const remaining = total - sum;
  const canSettle = remaining === 0 && lines.every((line, index) => paise[index] > 0);

  function updateLine(id: number, patch: Partial<PaymentLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const remainingRupees = Math.max(0, remaining) / 100;
    setLines((current) => [
      ...current,
      { id: nextLineId++, mode: defaultMode, amount: remainingRupees > 0 ? remainingRupees.toFixed(2) : "" },
    ]);
  }

  function removeLine(id: number) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-small font-semibold uppercase tracking-wide text-text-muted">
        Payment Method
      </h3>

      {lines.map((line, index) => (
        <div key={line.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = line.mode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => updateLine(line.id, { mode: option.mode })}
                    aria-pressed={isActive}
                    title={option.label}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-small font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-muted hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                className="text-small text-text-muted hover:text-error"
                aria-label="Remove payment line"
              >
                Remove
              </button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-small text-text-muted">₹</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={line.amount}
              onChange={(event) => updateLine(line.id, { amount: event.target.value })}
              className="w-full rounded-md border border-border px-2 py-1.5 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label={`Amount for ${line.mode}`}
            />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addLine}
        className="self-start text-small font-medium text-secondary hover:underline"
      >
        + Split across another mode
      </button>

      <div className="flex items-center justify-between text-small">
        <span className="text-text-muted">Remaining</span>
        <span className={`font-medium ${remaining === 0 ? "text-success" : "text-error"}`}>
          {formatMoney(Math.abs(remaining))}
          {remaining !== 0 ? (remaining > 0 ? " left" : " over") : ""}
        </span>
      </div>

      {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

      <button
        type="button"
        disabled={!canSettle || isSettling}
        onClick={() =>
          onSettle(
            lines.map((line, index) => ({ mode: line.mode, amount: paise[index] })),
          )
        }
        className="w-full rounded-lg bg-accent px-4 py-3 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-50"
      >
        {isSettling ? "Settling…" : `Collect ${formatMoney(total)}`}
      </button>
    </div>
  );
}
