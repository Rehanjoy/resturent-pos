"use client";

import { EditIcon, HistoryIcon, TrashIcon } from "@/components/icons";
import { formatQuantity, formatStockQuantity } from "@/lib/inventory/units";
import { formatMoney } from "@/lib/format";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/inventory/types";

export function buildInventoryCategoryNameMap(categories: InventoryCategory[]): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

export function buildSupplierNameMap(suppliers: Supplier[]): Map<string, string> {
  return new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
}

type StockTone = "error" | "warning" | "success";

function stockMetrics(item: InventoryItem): { percent: number; tone: StockTone; label: string; detail: string } {
  const days = item.daysRemaining;
  const dailyUsage = item.expectedDailyUsage || (days && days > 0 ? item.currentStock / days : 0);
  const targetStock = dailyUsage > 0
    ? dailyUsage * 7
    : item.reorderThreshold > 0
      ? item.reorderThreshold * 2
      : item.currentStock;
  const percent = item.currentStock <= 0 || targetStock <= 0
    ? 0
    : Math.max(3, Math.min(100, Math.round((item.currentStock / targetStock) * 100)));

  if (item.currentStock <= 0) return { percent: 0, tone: "error", label: "Out of stock", detail: "Stock entry required" };
  if (item.currentStock <= item.reorderThreshold || (days != null && days <= 1)) {
    return { percent, tone: "error", label: "Critical", detail: "Restock now" };
  }
  if (days != null && days < 7) {
    return { percent, tone: "warning", label: days <= 3 ? "Restock soon" : "Plan restock", detail: `${Number(days.toFixed(1))} days cover` };
  }
  return { percent, tone: "success", label: "Healthy", detail: days == null ? "Above minimum" : `${Number(days.toFixed(1))} days cover` };
}

const BAR_CLASS: Record<StockTone, string> = {
  error: "bg-error",
  warning: "bg-warning",
  success: "bg-success",
};

const STATUS_CLASS: Record<StockTone, string> = {
  error: "bg-error/10 text-error",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/10 text-success",
};

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted lg:hidden">{children}</span>;
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
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-white/75 shadow-sm backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="block w-full text-left text-body lg:table">
          <thead className="hidden border-b border-border/70 bg-background/55 lg:table-header-group">
            <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
              <th className="px-4 py-3">Ingredient</th>
              <th className="px-4 py-3">Stock &amp; coverage</th>
              <th className="px-4 py-3">Today</th>
              <th className="px-4 py-3">Runway</th>
              <th className="px-4 py-3">Cost &amp; supplier</th>
              <th className="px-4 py-3 text-right">Status &amp; actions</th>
            </tr>
          </thead>
          <tbody className="grid gap-3 p-3 sm:grid-cols-2 lg:table-row-group lg:p-0">
            {items.map((item) => {
              const metrics = stockMetrics(item);
              const linkedCount = linkedDishCounts[item.id] ?? 0;
              const shouldReorder = metrics.tone !== "success";
              const received = item.today?.received ?? 0;
              const used = item.today?.used ?? 0;
              const wasted = item.today?.wasted ?? 0;

              return (
                <tr key={item.id} className="group block rounded-xl border border-border/75 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-border/55 lg:p-0 lg:last:border-b-0">
                  <td className="block align-middle lg:table-cell lg:px-4 lg:py-3.5">
                    <div className="min-w-44">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-text">{item.name}</strong>
                        {linkedCount > 0 ? <span title={`Used in ${linkedCount} menu dish${linkedCount > 1 ? "es" : ""}`} className="rounded-md bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-info">{linkedCount} {linkedCount === 1 ? "dish" : "dishes"}</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-text-muted">{categoryNameById.get(item.categoryId) ?? "Uncategorized"}</p>
                    </div>
                  </td>

                  <td className="mt-4 block align-middle lg:mt-0 lg:table-cell lg:px-4 lg:py-3.5">
                    <MobileLabel>Stock &amp; coverage</MobileLabel>
                    <div className="w-full lg:w-48">
                      <div className="flex items-baseline justify-between gap-3">
                        <strong className="text-sm tabular-nums text-text">{formatStockQuantity(item.currentStock, item.unit)}</strong>
                        <span className="whitespace-nowrap text-[10px] text-text-muted">Min {formatQuantity(item.reorderThreshold)} {item.unit}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/55" role="progressbar" aria-label={`${item.name} stock coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.percent}>
                        <div className={`h-full rounded-full transition-[width] duration-500 ${BAR_CLASS[metrics.tone]}`} style={{ width: `${metrics.percent}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-muted"><span>{metrics.percent}% of 7-day target</span><span>{metrics.detail}</span></div>
                    </div>
                  </td>

                  <td className="mt-4 block align-middle lg:mt-0 lg:table-cell lg:px-4 lg:py-3.5">
                    <MobileLabel>Movement today</MobileLabel>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                      <span className="font-semibold text-success">+{formatQuantity(received)} {item.unit}</span>
                      <span className="text-text-muted">−{formatQuantity(used)} {item.unit}</span>
                      {wasted > 0 ? <span className="font-medium text-error">Waste {formatQuantity(wasted)}</span> : null}
                    </div>
                    {item.today?.corrected ? <p className="mt-1 text-[10px] text-info">Correction {formatQuantity(item.today.corrected)} {item.unit}</p> : null}
                  </td>

                  <td className="mt-4 block align-middle lg:mt-0 lg:table-cell lg:px-4 lg:py-3.5">
                    <MobileLabel>Runway</MobileLabel>
                    {item.daysRemaining == null ? <span className="text-xs text-text-muted">Usage data needed</span> : <div><strong className={`text-sm tabular-nums ${metrics.tone === "error" ? "text-error" : metrics.tone === "warning" ? "text-warning" : "text-success"}`}>{Number(item.daysRemaining.toFixed(1))} days</strong><p className="mt-1 text-[10px] text-text-muted">{formatQuantity(item.expectedDailyUsage || 0)} {item.unit}/day planned</p></div>}
                  </td>

                  <td className="mt-4 block align-middle lg:mt-0 lg:table-cell lg:px-4 lg:py-3.5">
                    <MobileLabel>Cost &amp; supplier</MobileLabel>
                    <strong className="text-sm tabular-nums text-text">{formatMoney(item.currentStock * item.costPerUnit)}</strong>
                    <p className="mt-1 text-[10px] text-text-muted">{formatMoney(item.costPerUnit)}/{item.unit} · {item.supplierId ? supplierNameById.get(item.supplierId) ?? "Unknown supplier" : "No supplier"}</p>
                  </td>

                  <td className="mt-4 block align-middle lg:mt-0 lg:table-cell lg:px-4 lg:py-3.5">
                    <MobileLabel>Status &amp; actions</MobileLabel>
                    <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                      <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[metrics.tone]}`}><span className={`h-1.5 w-1.5 rounded-full ${BAR_CLASS[metrics.tone]}`} />{metrics.label}</span>
                      <div className="flex items-center gap-1">
                        {canManage ? <button type="button" onClick={() => onAdjust(item)} title={`Add or adjust stock for ${item.name}`} className="min-h-9 rounded-lg border border-border/80 bg-white px-2.5 text-[11px] font-semibold text-text shadow-xs transition hover:border-primary/30 hover:text-primary">Stock entry</button> : null}
                        {shouldReorder && canManage ? <button type="button" disabled={isTogglingReorder(item)} onClick={() => onToggleReorderRequested(item)} title={item.reorderRequested ? "Mark purchase as pending" : "Create a reorder request"} className="min-h-9 rounded-lg px-2.5 text-[11px] font-semibold text-warning transition hover:bg-warning/10 disabled:opacity-50">{item.reorderRequested ? "Requested" : "Reorder"}</button> : null}
                        <button type="button" onClick={() => onOpenHistory(item)} aria-label={`View rate history for ${item.name}`} title="Rate history" className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-background hover:text-primary"><HistoryIcon className="h-4 w-4" /></button>
                        {canManage ? <><button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} title="Edit ingredient" className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-background hover:text-secondary"><EditIcon className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`} title="Delete ingredient" className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-error/10 hover:text-error"><TrashIcon className="h-4 w-4" /></button></> : null}
                      </div>
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
