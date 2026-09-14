"use client";

import { useState } from "react";
import { DiningSheet } from "./dining-sheet";
import { formatMoney } from "@/lib/format";
import type { CartItem, DiningMenuItem } from "@/lib/dining/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SPICE_OPTIONS = ["As prepared", "Mild", "Medium", "Spicy"];

export function MenuCustomization({ item, onClose, onAdd }: { item: DiningMenuItem; onClose: () => void; onAdd: (item: CartItem) => void }) {
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState("As prepared");
  const [notes, setNotes] = useState("");

  return (
    <DiningSheet title={item.name} onClose={onClose}>
      <p className="mb-5 text-sm text-text-muted">{item.description || "Freshly prepared by our kitchen."}</p>

      <div className="mb-6 flex justify-between">
        <strong className="text-xl">{formatMoney(item.price)}</strong>
        <span className="text-sm text-text-muted">About {item.prepMinutes} min</span>
      </div>

      <fieldset>
        <legend className="mb-3 font-semibold">Spice preference</legend>
        <div className="grid grid-cols-2 gap-2">
          {SPICE_OPTIONS.map((value) => (
            <Label
              key={value}
              className={`min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-normal ${spice === value ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="radio"
                name="guest-spice"
                value={value}
                checked={spice === value}
                onChange={() => setSpice(value)}
                className="accent-primary"
              />
              {value}
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="my-5">
        <Label htmlFor="kitchen-instructions" className="mb-2 font-semibold">Kitchen instructions</Label>
        <textarea
          id="kitchen-instructions"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={250}
          rows={3}
          placeholder="No onions, dietary requests…"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus-visible:border-primary"
        />
        <span className="text-xs text-text-muted">For allergies, please also speak with your waiter. Extras are confirmed by staff.</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 rounded-full bg-background p-1">
          <Button type="button" variant="outline" size="icon" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>
            −
          </Button>
          <span className="w-9 text-center font-semibold">{qty}</span>
          <Button type="button" size="icon" disabled={qty >= 50} aria-label="Increase quantity" onClick={() => setQty(qty + 1)}>
            +
          </Button>
        </div>
        <Button
          type="button"
          variant="accent"
          size="lg"
          className="flex-1"
          onClick={() => onAdd({
            key: crypto.randomUUID(),
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            qty,
            notes: [spice !== "As prepared" ? `Spice: ${spice}` : "", notes.trim()].filter(Boolean).join(". ") || undefined,
          })}
        >
          Add · {formatMoney(item.price * qty)}
        </Button>
      </div>
    </DiningSheet>
  );
}
