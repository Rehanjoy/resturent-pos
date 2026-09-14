"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { InventoryItem } from "@/lib/inventory/types";
import { formatStockQuantity } from "@/lib/inventory/units";

export interface InventoryMovementInput {
  quantityDelta: number;
  reason: string;
  movementType?: "restock" | "usage" | "wastage" | "adjustment";
}

const REASON_PRESETS: Record<"restock" | "usage" | "wastage" | "adjustment", string[]> = {
  restock: ["Supplier delivery", "Emergency local market purchase", "Inter-branch transfer in"],
  usage: ["Prep batch extra usage", "Staff meal prep", "Tasting & menu sampling"],
  wastage: ["Storage spoilage / expiry", "Prep trim & cut loss", "Spill / accidental breakage"],
  adjustment: ["Weekly physical count audit", "Opening stock correction", "System entry reconciliation"],
};

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
  const [movementType, setMovementType] = useState<"restock" | "usage" | "wastage" | "adjustment">(
    "restock"
  );
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [magnitude, setMagnitude] = useState("");
  const [reason, setReason] = useState("");

  const numMagnitude = Number(magnitude) || 0;
  const delta =
    movementType === "restock"
      ? numMagnitude
      : movementType === "adjustment" && direction === "add"
      ? numMagnitude
      : -numMagnitude;

  const resultingStock = item.currentStock + delta;

  return (
    <Modal title={`Stock Entry — ${item.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!Number.isFinite(numMagnitude) || numMagnitude <= 0 || isSubmitting) return;
          onSubmit({
            movementType,
            quantityDelta: delta,
            reason: reason.trim(),
          });
        }}
        className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1"
      >
        {/* Current Stock & Projected Balance Card */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 p-3.5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Current On Hand
            </span>
            <p className="text-base font-bold text-text">
              {formatStockQuantity(item.currentStock, item.unit)}
            </p>
          </div>

          <div className="text-center text-xs font-bold text-text-muted">➔</div>

          <div className="text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Projected Balance
            </span>
            <p
              className={`text-base font-bold ${
                resultingStock < 0
                  ? "text-error"
                  : resultingStock <= item.reorderThreshold
                  ? "text-warning"
                  : "text-success"
              }`}
            >
              {numMagnitude > 0 ? formatStockQuantity(resultingStock, item.unit) : "—"}
            </p>
          </div>
        </div>

        {/* Movement Type Tabs */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-text">Entry Type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: "restock", label: "Received", icon: "📦", desc: "Supplier delivery" },
              { id: "usage", label: "Extra Usage", icon: "🍳", desc: "Extra consumption" },
              { id: "wastage", label: "Wastage", icon: "🗑️", desc: "Spoilage / loss" },
              { id: "adjustment", label: "Audit Count", icon: "⚖️", desc: "Count correction" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMovementType(tab.id as typeof movementType);
                  if (tab.id === "adjustment") setDirection("remove");
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  movementType === tab.id
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                    : "border-border bg-surface text-text-muted hover:border-border/80 hover:text-text"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="mt-1 text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Informative Guidance */}
        <p className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs text-text-muted">
          {movementType === "usage"
            ? "Record extra usage not deducted by kitchen orders. Regular food orders automatically deduct stock."
            : movementType === "restock"
            ? "Supplier delivery adds stock to your current on-hand register and appears under today's receipts."
            : movementType === "wastage"
            ? "Spoiled, expired, or spilled ingredients tracked separately to monitor loss patterns."
            : "Physical count audit. Directly corrects discrepancies between real storage count and system balance."}
        </p>

        {/* Direction Switcher for Physical Audit */}
        {movementType === "adjustment" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("remove")}
              className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                direction === "remove"
                  ? "border-error bg-error/15 text-error shadow-2xs"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              - Decrease Stock (Shortfall)
            </button>
            <button
              type="button"
              onClick={() => setDirection("add")}
              className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                direction === "add"
                  ? "border-success bg-success/15 text-success shadow-2xs"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              + Increase Stock (Surplus)
            </button>
          </div>
        )}

        {/* Quantity Input with attached Unit Tag */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-text">
            Quantity to {movementType === "restock" || (movementType === "adjustment" && direction === "add") ? "Add" : "Deduct"} ({item.unit})
          </span>
          <div className="relative">
            <input
              type="number"
              min={0.000001}
              step="any"
              value={magnitude}
              onChange={(event) => setMagnitude(event.target.value)}
              placeholder="0.00"
              required
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 pr-14 text-sm font-bold text-text shadow-2xs focus:border-primary focus:outline-none"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md bg-background px-2 py-0.5 text-xs font-semibold text-text-muted">
              {item.unit}
            </span>
          </div>
        </label>

        {/* Reason & Quick Presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-text">Reason / Reference Note</span>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {REASON_PRESETS[movementType].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted hover:border-primary hover:text-text transition-colors"
              >
                + {preset}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={2}
            maxLength={300}
            placeholder="Provide a clear explanation for audit tracking..."
            className="rounded-xl border border-border bg-surface p-3 text-xs text-text shadow-2xs focus:border-primary focus:outline-none"
          />
        </div>

        {errorMessage && (
          <p role="alert" className="text-xs font-semibold text-error">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-muted hover:bg-background hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !magnitude || Number(magnitude) <= 0 || !reason.trim()}
            className="min-h-10 rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Recording..." : "Save Stock Entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
