"use client";

import { EditIcon, HistoryIcon, TrashIcon } from "@/components/icons";
import { formatQuantity, formatStockQuantity } from "@/lib/inventory/units";
import { formatMoney } from "@/lib/format";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/inventory/types";

export function buildInventoryCategoryNameMap(
  categories: InventoryCategory[]
): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

export function buildSupplierNameMap(suppliers: Supplier[]): Map<string, string> {
  return new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
}

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
  return formatStockQuantity(item.currentStock, item.unit);
}

export function InventoryTable({
  items,
  linkedDishCounts,
  categoryNameById,
  supplierNameById,
  canManage,
  isTogglingReorder,
  onToggleReorderRequested,
  onOpenHistory,
  onAdjust,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  linkedDishCounts: Record<string, number>;
  categoryNameById: Map<string, string>;
  supplierNameById: Map<string, string>;
  canManage: boolean;
  isTogglingReorder: (item: InventoryItem) => boolean;
  onToggleReorderRequested: (item: InventoryItem) => void;
  onOpenHistory: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
      <div className="overflow-x-auto">
        <table className="block w-full text-left text-body lg:table">
          <thead className="hidden lg:table-header-group bg-background/60 border-b border-border">
            <tr className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3.5">Ingredient Item</th>
              <th className="px-4 py-3.5">Stock Level</th>
              <th className="px-4 py-3.5">Today (IST)</th>
              <th className="px-4 py-3.5">Runway / Daily Plan</th>
              <th className="px-4 py-3.5">Supplier</th>
              <th className="px-4 py-3.5">Stock Value</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="grid gap-3 p-3 sm:grid-cols-2 lg:table-row-group lg:p-0">
            {items.map((item) => {
              const tone = stockLevelTone(item);
              const percent = stockLevelPercent(item);
              const isLow = item.currentStock <= item.reorderThreshold;
              const value = Math.round(item.currentStock * item.costPerUnit);
              const linkedCount = linkedDishCounts[item.id] ?? 0;

              return (
                <tr
                  key={item.id}
                  className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-background/40 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-border/60 lg:p-0 lg:last:border-0"
                >
                  {/* Item Column */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text text-sm">{item.name}</span>
                        {linkedCount > 0 && (
                          <span
                            title={`Used in ${linkedCount} menu dish${linkedCount > 1 ? "es" : ""}`}
                            className="inline-flex items-center rounded-md bg-secondary/10 px-1.5 py-0.5 text-[10px] font-semibold text-secondary whitespace-nowrap"
                          >
                            {linkedCount} dish{linkedCount > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="rounded-md bg-background px-2 py-0.5 font-medium">
                          {categoryNameById.get(item.categoryId) ?? "Uncategorized"}
                        </span>
                        <span>•</span>
                        <span>Base unit: <strong>{item.unit}</strong></span>
                      </div>
                    </div>
                  </td>

                  {/* Stock Level Column */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex w-full flex-col gap-1.5 lg:w-44">
                      <div className="flex items-baseline justify-between text-xs">
                        <strong className="font-bold text-text text-sm">
                          {formatStock(item)}
                        </strong>
                        <span className="text-[11px] text-text-muted">
                          Min: {item.reorderThreshold} {item.unit}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${BAR_TONE_CLASS[tone]}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {item.currentStock <= 0 ? (
                        <span className="text-[11px] font-semibold text-error">Out of stock!</span>
                      ) : isLow ? (
                        <span className="text-[11px] font-medium text-warning">Below reorder point</span>
                      ) : (
                        <span className="text-[11px] text-text-muted">Healthy stock buffer</span>
                      )}
                    </div>
                  </td>

                  {/* Today (IST) Column */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                          In: +{formatQuantity(item.today?.received ?? 0)} {item.unit}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                          Out: -{formatQuantity(item.today?.used ?? 0)} {item.unit}
                        </span>
                      </div>
                      {(item.today?.wasted ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-error/10 px-1.5 py-0.5 text-[11px] font-medium text-error w-fit">
                          Waste: {formatQuantity(item.today?.wasted ?? 0)} {item.unit}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-muted">No waste logged today</span>
                      )}
                      {!!item.today?.corrected && (
                        <span className="text-[10px] text-info">
                          Correction: {formatQuantity(item.today.corrected)} {item.unit}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Daily Plan / Runway */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex flex-col gap-1">
                      {item.daysRemaining == null ? (
                        <span className="inline-flex w-fit items-center rounded-full bg-background px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                          No usage data
                        </span>
                      ) : item.daysRemaining <= 1 ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 text-xs font-bold text-error">
                          <span className="h-1.5 w-1.5 rounded-full bg-error animate-pulse" />
                          {Number(item.daysRemaining.toFixed(1))} days left
                        </span>
                      ) : item.daysRemaining <= 3 ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                          {Number(item.daysRemaining.toFixed(1))} days left
                        </span>
                      ) : (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {Number(item.daysRemaining.toFixed(1))} days left
                        </span>
                      )}
                      <span className="text-[11px] text-text-muted">
                        {item.expectedDailyUsage || 0} {item.unit} / day planned
                      </span>
                    </div>
                  </td>

                  {/* Supplier */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle text-xs font-medium text-text-muted">
                    {item.supplierId ? (
                      <span className="text-text font-medium">
                        {supplierNameById.get(item.supplierId) ?? "—"}
                      </span>
                    ) : (
                      <span className="text-text-muted/60 italic">No supplier</span>
                    )}
                  </td>

                  {/* Stock Value */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex flex-col">
                      <strong className="text-sm font-bold text-text tabular-nums">
                        {formatMoney(value)}
                      </strong>
                      <span className="text-[11px] text-text-muted tabular-nums">
                        {formatMoney(item.costPerUnit)} / {item.unit}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    {isLow ? (
                      <button
                        type="button"
                        disabled={!canManage || isTogglingReorder(item)}
                        onClick={() => onToggleReorderRequested(item)}
                        title={
                          canManage
                            ? item.reorderRequested
                              ? "Mark as pending order"
                              : "Mark as reorder requested"
                            : undefined
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all disabled:cursor-default ${
                          item.reorderRequested
                            ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                            : item.currentStock <= 0
                            ? "bg-error/15 text-error hover:bg-error/25"
                            : "bg-warning/15 text-warning hover:bg-warning/25"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.reorderRequested
                              ? "bg-secondary"
                              : item.currentStock <= 0
                              ? "bg-error"
                              : "bg-warning"
                          }`}
                        />
                        {item.currentStock <= 0
                          ? "Out of Stock"
                          : "Low Stock"}
                        {" • "}
                        {item.reorderRequested ? "Reordered" : "Reorder"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        In Stock
                      </span>
                    )}
                  </td>

                  {/* Actions Column */}
                  <td className="block lg:table-cell px-4 py-3.5 align-middle">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onAdjust(item)}
                          title={`Adjust stock for ${item.name}`}
                          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text shadow-2xs transition-colors hover:bg-background hover:text-primary"
                        >
                          Stock entry
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenHistory(item)}
                        title={`Rate history for ${item.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-primary"
                      >
                        <HistoryIcon className="h-4 w-4" />
                      </button>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title={`Edit ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-secondary"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            title={`Delete ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
