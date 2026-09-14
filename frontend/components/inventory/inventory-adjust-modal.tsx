"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { InventoryItem } from "@/lib/inventory/types";

export interface InventoryMovementInput { quantityDelta: number; reason: string; movementType?: "restock" | "usage" | "wastage" | "adjustment" }

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
  onSubmit: (input: InventoryMovementInput) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [movementType, setMovementType] = useState<"restock" | "usage" | "wastage" | "adjustment">("restock");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [magnitude, setMagnitude] = useState("");
  const [reason, setReason] = useState("");

  return (
    <Modal title={`Stock entry — ${item.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = Number(magnitude);
          if (!Number.isFinite(value) || value <= 0 || isSubmitting) return;
          onSubmit({
            movementType,
            quantityDelta: movementType === "restock" ? value : movementType === "adjustment" && direction === "add" ? value : -value,
            reason: reason.trim(),
          });
        }}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
      >
        <p className="text-small text-text-muted">
          Currently {item.currentStock} {item.unit} on hand.
        </p>

        <label className="flex flex-col gap-1 text-small font-medium">Entry type
          <select value={movementType} onChange={(event) => setMovementType(event.target.value as typeof movementType)} className="rounded-lg border border-border p-3 text-body">
            <option value="restock">Received today</option><option value="usage">Extra usage</option>
            <option value="wastage">Wastage</option><option value="adjustment">Stock correction</option>
          </select>
        </label>
        <p className="rounded-xl bg-background p-3 text-small text-text-muted">
          {movementType === "usage" ? "Only record usage not already deducted through kitchen orders. Entering the full day's usage again would double-count it."
            : movementType === "restock" ? "Supplier delivery: adds stock and appears in today's receipts."
            : movementType === "wastage" ? "Spoiled or discarded ingredients are tracked separately from order consumption."
            : "Physical count correction. This does not count as a delivery or daily consumption."}
        </p>
        {movementType === "adjustment" && <div className="flex gap-2">
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
        </div>}

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
            maxLength={300}
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
            {isSubmitting ? "Saving…" : "Save entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
