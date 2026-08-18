"use client";

import { formatMoney } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/orders/types";
import type { RestaurantTable } from "@/lib/tables/types";
import { KotHistory } from "./kot-history";

/**
 * Right-hand persistent cart rail (client's reference-screenshot layout).
 * Combines what used to be two separate panels: the already-sent "KOT
 * history" (now the "In Kitchen" section, grouped by status per the
 * reference) and the editable pending-items cart — both live in this one
 * rail now, matching the reference screenshot's single persistent panel
 * rather than splitting kitchen status into the main content column.
 *
 * Subtotal reads from `order.subtotal` (the whole order, sent + pending —
 * see `order.service.ts` `toOrderDto`), not just the pending items, so it
 * reflects the true running total for the table. Tax/discount/final total
 * are still owned by the Billing module (PRD §3.3/§3.10 scoping) — this
 * rail only ever shows the pre-tax subtotal.
 */
export function CartRail({
  table,
  order,
  pendingItems,
  sentItems,
  onIncrement,
  onDecrement,
  onRemove,
  onSendToKitchen,
  isSending,
  isUpdating,
  canBuild,
}: {
  table?: RestaurantTable;
  order: Order;
  pendingItems: OrderItem[];
  sentItems: OrderItem[];
  onIncrement: (item: OrderItem) => void;
  onDecrement: (item: OrderItem) => void;
  onRemove: (item: OrderItem) => void;
  onSendToKitchen: () => void;
  isSending: boolean;
  isUpdating: boolean;
  canBuild: boolean;
}) {
  return (
    <aside className="flex w-full max-w-sm shrink-0 flex-col self-start rounded-2xl border border-border bg-surface shadow-sm lg:sticky lg:top-6">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-h3 font-semibold text-text">
          {table ? table.name : "Order"}
        </h2>
        <p className="text-small text-text-muted">Order #{order.id.slice(-6).toUpperCase()}</p>
      </div>

      <div className="max-h-[60vh] flex-1 overflow-y-auto">
        {sentItems.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <h3 className="mb-2 text-small font-semibold uppercase tracking-wide text-text-muted">
              In Kitchen
            </h3>
            <KotHistory items={sentItems} />
          </div>
        )}

        <div className="px-4 py-3">
          <h3 className="mb-2 text-small font-semibold uppercase tracking-wide text-text-muted">
            New Items
          </h3>
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
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-body">
          <span className="text-text-muted">Subtotal</span>
          <span className="text-numeric font-semibold text-text">{formatMoney(order.subtotal)}</span>
        </div>
        <p className="mt-1 text-small text-text-muted">
          Tax, discount, and total are calculated at settlement.
        </p>

        {canBuild && (
          <button
            type="button"
            disabled={pendingItems.length === 0 || isSending}
            onClick={onSendToKitchen}
            className="mt-3 w-full rounded-lg bg-accent px-4 py-3 text-button text-white disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send to Kitchen"}
          </button>
        )}
      </div>
    </aside>
  );
}
