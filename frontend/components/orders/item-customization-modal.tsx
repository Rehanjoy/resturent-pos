"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/format";
import type { MenuItem, SpiceLevel } from "@/lib/menu/types";

const SPICE_OPTIONS: SpiceLevel[] = ["mild", "medium", "spicy"];

// The menu/dish catalog has no per-dish add-on list yet (out of scope for
// the Menu module as built) — a small fixed preset covers the common
// restaurant cases for this build. A real per-dish add-on catalog (with
// its own pricing) is a natural Menu-module follow-up.
const ADD_ON_PRESETS = ["Extra Cheese", "Extra Gravy", "No Onion", "No Garlic", "Less Spicy"];

export interface ItemCustomization {
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
}

/**
 * Customization step shown after tapping a dish on the New/Active Order
 * screen — spice level, add-ons, notes — before it's added to the cart
 * (PRD §3.3 "item customization: spice level, add-ons, notes").
 */
export function ItemCustomizationModal({
  item,
  onClose,
  onAdd,
  isSubmitting,
  errorMessage,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (customization: ItemCustomization) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [qty, setQty] = useState(1);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel | "">(item.spiceLevel ?? "");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  function toggleAddOn(addOn: string) {
    setAddOns((current) =>
      current.includes(addOn) ? current.filter((value) => value !== addOn) : [...current, addOn],
    );
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-numeric font-semibold text-text">{formatMoney(item.price)}</p>

        <div className="flex items-center gap-3">
          <span className="text-small font-medium text-text">Quantity</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty((current) => Math.max(1, current - 1))}
              className="h-8 w-8 rounded-md border border-border text-text hover:bg-background"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center text-body text-text">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((current) => current + 1)}
              className="h-8 w-8 rounded-md border border-border text-text hover:bg-background"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-small font-medium text-text">Spice level</legend>
          <div className="flex flex-wrap gap-2">
            {SPICE_OPTIONS.map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-small capitalize ${
                  spiceLevel === option
                    ? "border-primary text-primary"
                    : "border-border text-text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="spiceLevel"
                  value={option}
                  checked={spiceLevel === option}
                  onChange={() => setSpiceLevel(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-small font-medium text-text">Add-ons</legend>
          <div className="flex flex-wrap gap-2">
            {ADD_ON_PRESETS.map((addOn) => (
              <label
                key={addOn}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-small ${
                  addOns.includes(addOn)
                    ? "border-primary text-primary"
                    : "border-border text-text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={addOns.includes(addOn)}
                  onChange={() => toggleAddOn(addOn)}
                  className="sr-only"
                />
                {addOn}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Special instructions</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="e.g. no coriander"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              onAdd({
                qty,
                spiceLevel: spiceLevel || undefined,
                addOns,
                notes: notes.trim() || undefined,
              })
            }
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add to Cart"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
