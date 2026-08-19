"use client";

import { EditIcon, TrashIcon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { formatMoney } from "@/lib/format";
import type { Category, MenuItem } from "@/lib/menu/types";

const TYPE_INDICATOR: Record<MenuItem["type"], { label: string; className: string }> = {
  veg: { label: "Veg", className: "border-success text-success" },
  "non-veg": { label: "Non-Veg", className: "border-error text-error" },
  egg: { label: "Egg", className: "border-warning text-warning" },
};

/**
 * Dense table layout for Menu Management (reference screenshot: Dish |
 * Category | Recipe/ingredients | Price | Available toggle, rather than the
 * previous card grid) — reads better once a restaurant has more than a
 * handful of dishes, matches the reference exactly. This app's `MenuItem`
 * model has no dedicated "recipe/ingredients" field (see
 * `backend/src/models/menu-item.model.ts`), so the Description column
 * stands in for it rather than inventing a backend field for this
 * frontend-only pass — every other column/action is a direct 1:1 port from
 * the previous `DishCard` grid (same mutations, same RBAC gate).
 */
export function DishTable({
  items,
  categoryNameById,
  canManage,
  isTogglingAvailability,
  onToggleAvailability,
  onEdit,
  onDelete,
}: {
  items: MenuItem[];
  categoryNameById: Map<string, string>;
  canManage: boolean;
  isTogglingAvailability: (item: MenuItem) => boolean;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Dish</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Available</th>
            {canManage && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const typeIndicator = TYPE_INDICATOR[item.type];
            return (
              <tr
                key={item.id}
                className={`border-b border-border last:border-0 ${item.isAvailable ? "" : "opacity-60"}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background text-small text-text-muted">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, not part of the optimized asset pipeline yet.
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        item.name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{item.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${typeIndicator.className}`}
                        >
                          {typeIndicator.label}
                        </span>
                        {item.spiceLevel && item.spiceLevel !== "none" && (
                          <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] capitalize text-text-muted">
                            {item.spiceLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {categoryNameById.get(item.categoryId) ?? "—"}
                </td>
                <td className="max-w-xs px-4 py-3 text-small text-text-muted">
                  {item.description ? (
                    <span className="line-clamp-2">{item.description}</span>
                  ) : (
                    <span className="text-text-muted/60">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-numeric font-semibold text-text">
                  {formatMoney(item.price)}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <ToggleSwitch
                      checked={item.isAvailable}
                      onChange={(next) => onToggleAvailability(item, next)}
                      disabled={isTogglingAvailability(item)}
                      label={`${item.isAvailable ? "Mark unavailable" : "Mark available"}: ${item.name}`}
                    />
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-small font-medium ${
                        item.isAvailable ? "bg-success/10 text-success" : "bg-error/10 text-error"
                      }`}
                    >
                      {item.isAvailable ? "Available" : "Not available"}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title={`Edit ${item.name}`}
                        aria-label={`Edit ${item.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        title={`Delete ${item.name}`}
                        aria-label={`Delete ${item.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Mirrors what `menu-screen.tsx` already computed once (`categories` list)
 * into a lookup the table needs — kept as a small helper here instead of
 * duplicating this `Map` construction in the screen file. */
export function buildCategoryNameMap(categories: Category[]): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}
