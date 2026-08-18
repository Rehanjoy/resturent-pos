"use client";

import { formatMoney } from "@/lib/format";
import type { MenuItem } from "@/lib/menu/types";

const TYPE_INDICATOR: Record<MenuItem["type"], { label: string; className: string }> = {
  veg: { label: "Veg", className: "border-success text-success" },
  "non-veg": { label: "Non-Veg", className: "border-error text-error" },
  egg: { label: "Egg", className: "border-warning text-warning" },
};

/**
 * Menu grid tile for the POS ordering screens (New/Active Order) — image,
 * name, price, veg/non-veg badge, dims and disables tapping when the dish
 * has been 86'd (`!isAvailable`). Deliberately separate from
 * `components/menu/dish-card.tsx`, which is the Menu *management* card
 * (edit/delete/availability-toggle actions); this one only starts the
 * customize-and-add-to-cart flow.
 */
export function OrderItemTile({
  item,
  onSelect,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}) {
  const typeIndicator = TYPE_INDICATOR[item.type];

  return (
    <button
      type="button"
      disabled={!item.isAvailable}
      onClick={() => onSelect(item)}
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition-shadow ${
        item.isAvailable ? "hover:shadow-md" : "cursor-not-allowed opacity-50"
      }`}
    >
      <div className="flex h-28 items-center justify-center bg-background text-small text-text-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, not part of the optimized asset pipeline yet.
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          "No image"
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-text">{item.name}</h3>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-small font-medium ${typeIndicator.className}`}
          >
            {typeIndicator.label}
          </span>
        </div>

        <p className="text-numeric font-semibold text-text">{formatMoney(item.price)}</p>

        {!item.isAvailable && (
          <span className="w-fit rounded-full border border-border px-2 py-0.5 text-small text-text-muted">
            Sold out
          </span>
        )}
      </div>
    </button>
  );
}
