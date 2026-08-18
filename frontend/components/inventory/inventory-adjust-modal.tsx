"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { InventoryItem } from "@/lib/inventory/types";

/** Manual stock adjustment (wastage/correction) — PRD §3.9 "Stock
 * adjustment log ... fully audited". A reason is always required; the
 * direction (add/remove) plus a positive magnitude is friendlier than
 * asking staff to type a signed number. */
export function InventoryAdjustModal({
  item,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (input: { quantityDelta: number; reason: string }) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [magnitude, setMagnitude] = useState("");
  const [reason, setReason] = useState("");

  return (
    <Modal title={`Adjust Stock — ${item.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = Number(magnitude);
          onSubmit({
            quantityDelta: direction === "remove" ? -value : value,
            reason: reason.trim(),
          });
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-small text-text-muted">
          Currently {item.currentStock} {item.unit} on hand.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDirection("remove")}
            className={`flex-1 rounded-lg border px-3 py-2 text-button transition-colors ${
              direction === "remove"
                ? "border-error bg-error/10 text-error"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            Remove stock
          </button>
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={`flex-1 rounded-lg border px-3 py-2 text-button transition-colors ${
              direction === "add"
                ? "border-success bg-success/10 text-success"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            Add stock
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">
            Quantity ({item.unit})
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={magnitude}
            onChange={(event) => setMagnitude(event.target.value)}
            required
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={2}
            placeholder="e.g. Spoilage, miscount correction, breakage…"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !magnitude || Number(magnitude) <= 0 || !reason.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save Adjustment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
