"use client";

import { formatMoney } from "@/lib/format";
import type { MenuItem } from "@/lib/menu/types";

const TYPE_INDICATOR: Record<MenuItem["type"], { label: string; className: string }> = {
  veg: { label: "Veg", className: "border-success text-success" },
  "non-veg": { label: "Non-Veg", className: "border-error text-error" },
  egg: { label: "Egg", className: "border-warning text-warning" },
};

export function DishCard({
  item,
  canManage,
  onToggleAvailability,
  onEdit,
  onDelete,
  isTogglingAvailability,
}: {
  item: MenuItem;
  canManage: boolean;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  isTogglingAvailability: boolean;
}) {
  const typeIndicator = TYPE_INDICATOR[item.type];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm ${
        item.isAvailable ? "" : "opacity-60"
      }`}
    >
      <div className="flex h-32 items-center justify-center bg-background text-small text-text-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, not part of the optimized asset pipeline yet.
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          "No image"
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-text">{item.name}</h3>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-small font-medium ${typeIndicator.className}`}
          >
            {typeIndicator.label}
          </span>
        </div>

        {item.description && (
          <p className="line-clamp-2 text-small text-text-muted">{item.description}</p>
        )}

        <p className="text-numeric font-semibold text-text">{formatMoney(item.price)}</p>

        {item.spiceLevel && item.spiceLevel !== "none" && (
          <span className="w-fit rounded-full border border-border px-2 py-0.5 text-small capitalize text-text-muted">
            {item.spiceLevel}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          {canManage ? (
            <label className="flex items-center gap-2 text-small text-text-muted">
              <input
                type="checkbox"
                checked={item.isAvailable}
                disabled={isTogglingAvailability}
                onChange={(event) => onToggleAvailability(item, event.target.checked)}
              />
              {item.isAvailable ? "Available" : "86'd"}
            </label>
          ) : (
            <span className="text-small text-text-muted">
              {item.isAvailable ? "Available" : "Not available"}
            </span>
          )}

          {canManage && (
            <div className="flex gap-2 text-small text-text-muted">
              <button type="button" onClick={() => onEdit(item)} className="hover:text-secondary">
                Edit
              </button>
              <button type="button" onClick={() => onDelete(item)} className="hover:text-error">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
