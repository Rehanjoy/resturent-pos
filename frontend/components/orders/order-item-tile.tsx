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
  disabled = false,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  disabled?: boolean;
}) {
  const typeIndicator = TYPE_INDICATOR[item.type];

  return (
    <button
      type="button"
      disabled={!item.isAvailable || disabled}
      onClick={() => onSelect(item)}
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-shadow ${
        item.isAvailable && !disabled ? "hover:shadow-md" : "cursor-not-allowed opacity-60"
      }`}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-background text-small text-text-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, not part of the optimized asset pipeline yet.
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl" aria-label="Dish photo unavailable">♨</span>
        )}
        {(!item.isAvailable || disabled) && (
          <span className="absolute right-2 top-2 rounded-full bg-text/80 px-2 py-0.5 text-small font-semibold text-white">
            {disabled ? "Order locked" : "Sold out"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-sm font-semibold text-text sm:text-base">{item.name}</h3>
          <span
            title={typeIndicator.label}
            aria-label={typeIndicator.label}
            className={`shrink-0 rounded border px-1 text-xs font-medium ${typeIndicator.className}`}
          >
            ●
          </span>
        </div>

        {item.description && (
          <p className="line-clamp-2 text-small text-text-muted">{item.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-1 pt-3">
          <p className="font-semibold tabular-nums text-text">{formatMoney(item.price)}</p>
          <span className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white">+ Add</span>
        </div>
      </div>
    </button>
  );
}
