"use client";

import { EditIcon, TrashIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/inventory/types";

/** Mirrors `dish-table.tsx` `buildCategoryNameMap` — same small lookup
 * helper, just for the Inventory module's own category collection. */
export function buildInventoryCategoryNameMap(
  categories: InventoryCategory[],
): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

export function buildSupplierNameMap(suppliers: Supplier[]): Map<string, string> {
  return new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
}

/** Stock-level bar fill, 0-100. A healthy reading is "twice the reorder
 * threshold or more" — there's no natural upper bound on stock otherwise,
 * so `reorderThreshold * 2` stands in as "fully stocked" for the bar's
 * purposes. Clamped both ends: negative/zero stock reads as an empty bar,
 * not a broken one. */
function stockLevelPercent(item: InventoryItem): number {
  if (item.currentStock <= 0) return 0;
  const target = item.reorderThreshold > 0 ? item.reorderThreshold * 2 : item.currentStock;
  return Math.max(0, Math.min(100, Math.round((item.currentStock / target) * 100)));
}

function stockLevelTone(item: InventoryItem): "error" | "warning" | "success" {
  if (item.currentStock <= 0) return "error";
  if (item.currentStock <= item.reorderThreshold) return "warning";
  return "success";
}

const BAR_TONE_CLASS: Record<"error" | "warning" | "success", string> = {
  error: "bg-error",
  warning: "bg-warning",
  success: "bg-success",
};

function formatStock(item: InventoryItem): string {
  const rounded = Math.round(item.currentStock * 100) / 100;
  return `${rounded} ${item.unit}`;
}

/**
 * Dense table for the Inventory screen (reference screenshot): Item
 * (name + category subtext) | Stock Level (bar relative to reorder
 * threshold) | Supplier | Value | Status (Reorder/Reordered badge) |
 * Actions. Same conventions as the just-redesigned `dish-table.tsx` —
 * `rounded-2xl` card shell, `canManage` gate hides every write action for
 * view-only roles (Chef, per PRD §2 "View (deduction only)").
 */
export function InventoryTable({
  items,
  categoryNameById,
  supplierNameById,
  canManage,
  isTogglingReorder,
  onToggleReorderRequested,
  onAdjust,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  categoryNameById: Map<string, string>;
  supplierNameById: Map<string, string>;
  canManage: boolean;
  isTogglingReorder: (item: InventoryItem) => boolean;
  onToggleReorderRequested: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Stock Level</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const tone = stockLevelTone(item);
            const percent = stockLevelPercent(item);
            const isLow = item.currentStock <= item.reorderThreshold;
            const value = Math.round(item.currentStock * item.costPerUnit);

            return (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-text">{item.name}</p>
                  <p className="text-small text-text-muted">
                    {categoryNameById.get(item.categoryId) ?? "—"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex w-40 flex-col gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                      <div
                        className={`h-full rounded-full transition-all ${BAR_TONE_CLASS[tone]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-small text-text-muted">
                      {formatStock(item)}
                      {" · reorder at "}
                      {item.reorderThreshold} {item.unit}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {item.supplierId ? (supplierNameById.get(item.supplierId) ?? "—") : "—"}
                </td>
                <td className="px-4 py-3 text-numeric font-semibold text-text">
                  {formatMoney(value)}
                </td>
                <td className="px-4 py-3">
                  {isLow ? (
                    <button
                      type="button"
                      disabled={!canManage || isTogglingReorder(item)}
                      onClick={() => onToggleReorderRequested(item)}
                      title={
                        canManage
                          ? item.reorderRequested
                            ? "Mark as not yet reordered"
                            : "Mark as reordered"
                          : undefined
                      }
                      className={`rounded-full px-2.5 py-1 text-small font-medium transition-colors disabled:cursor-default ${
                        item.reorderRequested
                          ? "bg-secondary/10 text-secondary"
                          : "bg-warning/10 text-warning"
                      } ${canManage ? "hover:opacity-80" : ""}`}
                    >
                      {item.reorderRequested ? "Reordered" : "Reorder"}
                    </button>
                  ) : (
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-small font-medium text-success">
                      In Stock
                    </span>
                  )}
                </td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAdjust(item)}
                        title={`Adjust stock: ${item.name}`}
                        aria-label={`Adjust stock: ${item.name}`}
                        className="rounded-lg px-2.5 py-1.5 text-small font-medium text-text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
                      >
                        Adjust
                      </button>
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
                ) : (
                  <td className="px-4 py-3" />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
