"use client";

import { useState } from "react";
import { DiningSheet } from "./dining-sheet";
import { formatMoney } from "@/lib/format";
import type { CartItem, DiningMenuItem } from "@/lib/dining/types";

export function MenuCustomization({ item, onClose, onAdd }: { item: DiningMenuItem; onClose: () => void; onAdd: (item: CartItem) => void }) {
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState("As prepared");
  const [notes, setNotes] = useState("");
  return <DiningSheet title={item.name} onClose={onClose}>
    <p className="mb-5 text-sm text-text-muted">{item.description || "Freshly prepared by our kitchen."}</p>
    <div className="mb-6 flex justify-between"><strong className="text-xl">{formatMoney(item.price)}</strong><span className="text-sm text-text-muted">About {item.prepMinutes} min</span></div>
    <fieldset><legend className="mb-3 font-semibold">Spice preference</legend><div className="grid grid-cols-2 gap-2">{["As prepared", "Mild", "Medium", "Spicy"].map((value) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${spice === value ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="guest-spice" value={value} checked={spice === value} onChange={() => setSpice(value)} className="accent-primary" />{value}</label>)}</div></fieldset>
    <label className="my-5 block"><span className="mb-2 block font-semibold">Kitchen instructions</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={250} rows={3} placeholder="No onions, dietary requests…" className="w-full resize-none rounded-xl border border-border p-3 text-sm" /><span className="text-xs text-text-muted">For allergies, please also speak with your waiter. Extras are confirmed by staff.</span></label>
    <div className="flex items-center gap-4"><div className="flex items-center rounded-full bg-background p-1"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} className="h-11 w-11 rounded-full bg-surface text-xl">−</button><span className="w-9 text-center font-semibold">{qty}</span><button type="button" aria-label="Increase quantity" disabled={qty >= 50} onClick={() => setQty(qty + 1)} className="h-11 w-11 rounded-full bg-text text-xl text-white disabled:opacity-40">+</button></div><button type="button" onClick={() => onAdd({ key: crypto.randomUUID(), menuItemId: item.id, name: item.name, price: item.price, qty, notes: [spice !== "As prepared" ? `Spice: ${spice}` : "", notes.trim()].filter(Boolean).join(". ") || undefined })} className="min-h-12 flex-1 rounded-full bg-accent px-3 font-semibold text-white">Add · {formatMoney(item.price * qty)}</button></div>
  </DiningSheet>;
}
