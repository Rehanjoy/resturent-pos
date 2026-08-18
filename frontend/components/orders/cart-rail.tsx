"use client";

import { formatMoney } from "@/lib/format";
import type { OrderItem } from "@/lib/orders/types";

/**
 * Right-hand persistent cart rail (client's reference-screenshot layout).
 * Shows only "pending" items — items not yet sent to the kitchen — since
 * once sent they move into the KOT history panel and can no longer be
 * edited here. Tax/discount/total are owned by the Billing module (next
 * part) — this only shows a running subtotal, per PRD §3.3/§3.10 scoping.
 */
export function CartRail({
  pendingItems,
  onIncrement,
  onDecrement,
  onRemove,
  onSendToKitchen,
  isSending,
  isUpdating,
  canBuild,
}: {
  pendingItems: OrderItem[];
  onIncrement: (item: OrderItem) => void;
  onDecrement: (item: OrderItem) => void;
  onRemove: (item: OrderItem) => void;
  onSendToKitchen: () => void;
  isSending: boolean;
  isUpdating: boolean;
  canBuild: boolean;
}) {
  const subtotal = pendingItems.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);

  return (
    <aside className="flex w-full max-w-sm shrink-0 flex-col rounded-lg border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-h3 font-semibold text-text">New Items</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {pendingItems.length === 0 ? (
          <p className="text-small text-text-muted">
            No new items yet. Tap a dish to add it to this order.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingItems.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-body font-medium text-text">{item.nameSnapshot}</p>
                  <p className="text-small text-text-muted">
                    {[
                      item.spiceLevel && item.spiceLevel !== "none" ? item.spiceLevel : null,
                      ...item.addOns,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {item.notes && <p className="text-small italic text-text-muted">{item.notes}</p>}
                  <p className="text-numeric text-text">{formatMoney(item.priceSnapshot)}</p>
                </div>
                {canBuild && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onDecrement(item)}
                      className="h-7 w-7 rounded-md border border-border text-text hover:bg-background disabled:opacity-60"
                      aria-label={`Decrease quantity of ${item.nameSnapshot}`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-body text-text">{item.qty}</span>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onIncrement(item)}
                      className="h-7 w-7 rounded-md border border-border text-text hover:bg-background disabled:opacity-60"
                      aria-label={`Increase quantity of ${item.nameSnapshot}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => onRemove(item)}
                      className="ml-1 text-small text-text-muted hover:text-error disabled:opacity-60"
                      aria-label={`Remove ${item.nameSnapshot}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-body">
          <span className="text-text-muted">Subtotal</span>
          <span className="text-numeric font-semibold text-text">{formatMoney(subtotal)}</span>
        </div>
        <p className="mt-1 text-small text-text-muted">
          Tax, discount, and total are calculated at settlement.
        </p>

        {canBuild && (
          <button
            type="button"
            disabled={pendingItems.length === 0 || isSending}
            onClick={onSendToKitchen}
            className="mt-3 w-full rounded-md bg-accent px-4 py-3 text-button text-white disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send to Kitchen"}
          </button>
        )}
      </div>
    </aside>
  );
}
