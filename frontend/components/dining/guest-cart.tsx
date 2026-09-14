"use client";

import { useState } from "react";
import type { CartItem, DiningPolicy, DiningTaxConfig } from "@/lib/dining/types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DiningSheet } from "./dining-sheet";
import { CancellationPolicy } from "./order-tracker";

export function GuestCart({
  cart,
  policy,
  taxConfig = [],
  isAdditionalOrder = false,
  busy,
  error,
  onClose,
  onChange,
  onPlace,
}: {
  cart: CartItem[];
  policy: DiningPolicy;
  taxConfig?: DiningTaxConfig[];
  isAdditionalOrder?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (cart: CartItem[]) => void;
  onPlace: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const taxes = taxConfig.map((tax) => ({ ...tax, amount: Math.round((subtotal * tax.ratePercent) / 100) }));
  const taxTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0);
  const total = subtotal + taxTotal;

  function removeOne(item: CartItem) {
    onChange(
      cart.flatMap((entry) =>
        entry.key !== item.key
          ? [entry]
          : entry.qty > 1
            ? [{ ...entry, qty: entry.qty - 1 }]
            : [],
      ),
    );
  }

  function addOne(item: CartItem) {
    onChange(cart.map((entry) => (entry.key === item.key ? { ...entry, qty: entry.qty + 1 } : entry)));
  }

  return (
    <DiningSheet title={isAdditionalOrder ? "Add to your order" : "Review your order"} onClose={() => { if (!busy) onClose(); }}>
      <div className="space-y-4">
        {cart.map((item) => (
          <div key={item.key} className="border-b border-border pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">{item.name}</h3>
                {item.notes && <p className="mt-1 text-xs text-text-muted">{item.notes}</p>}
              </div>
              <strong className="shrink-0 text-sm">{formatMoney(item.price * item.qty)}</strong>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={`Remove one ${item.name}`} onClick={() => removeOne(item)}>
                −
              </Button>
              <span className="w-6 text-center text-sm">{item.qty}</span>
              <Button type="button" size="icon" disabled={busy || item.qty >= 50} aria-label={`Add one ${item.name}`} onClick={() => addOne(item)}>
                +
              </Button>
            </div>
          </div>
        ))}

        {!cart.length && (
          <p className="py-4 text-center text-text-muted">Your order is empty. Add a dish from the menu.</p>
        )}

        <div className="rounded-2xl bg-background p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Food subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          {taxes.map((tax) => (
            <div key={tax.name} className="mt-2 flex justify-between">
              <span className="text-text-muted">{tax.name} ({tax.ratePercent}%)</span>
              <span>{formatMoney(tax.amount)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-dashed border-border pt-3 text-lg font-semibold">
            <span>{isAdditionalOrder ? "Added to bill" : "Order total"}</span>
            <span>{formatMoney(total)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            {taxes.length
              ? `${formatMoney(subtotal)} food + ${formatMoney(taxTotal)} tax = ${formatMoney(total)}.`
              : "No tax is currently configured for this menu."}{" "}
            This amount is added to your counter bill.
          </p>
        </div>

        <CancellationPolicy policy={policy} />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          I reviewed the total and cancellation policy above.
        </label>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={busy || !cart.length || !accepted}
          onClick={onPlace}
        >
          {busy ? "Sending to kitchen…" : isAdditionalOrder ? `Add items · ${formatMoney(total)}` : `Place order · ${formatMoney(total)}`}
        </Button>
      </div>
    </DiningSheet>
  );
}
