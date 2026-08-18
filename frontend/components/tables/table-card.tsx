"use client";

import { ChairIcon, ReceiptIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/orders/types";
import type { RestaurantTable, TableStatus } from "@/lib/tables/types";

const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  needs_cleaning: "Cleaning",
};

// Semantic tokens from docs/02-brand-kit.md — unchanged mapping from the
// pre-redesign card (free=success, occupied=primary, reserved=info,
// needs_cleaning=warning), just expressed as a status dot + left accent
// bar instead of a full pill badge, per the reference screenshots.
const STATUS_DOT: Record<TableStatus, string> = {
  free: "bg-success",
  occupied: "bg-primary",
  reserved: "bg-info",
  needs_cleaning: "bg-warning",
};

const STATUS_TEXT: Record<TableStatus, string> = {
  free: "text-success",
  occupied: "text-primary",
  reserved: "text-info",
  needs_cleaning: "text-warning",
};

const STATUS_OPTIONS: TableStatus[] = ["free", "occupied", "reserved", "needs_cleaning"];

export function TableCard({
  table,
  areaName,
  order,
  canManage,
  canChangeStatus,
  canBill,
  onOpen,
  onBill,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  table: RestaurantTable;
  areaName?: string;
  /** The table's current live order, if any — used only to show item
   * count + running amount on occupied tables. `undefined` while the
   * order lookup is still loading or the table has no live order. */
  order?: Order;
  canManage: boolean;
  canChangeStatus: boolean;
  canBill: boolean;
  onOpen: (table: RestaurantTable) => void;
  onBill: (order: Order) => void;
  onStatusChange: (table: RestaurantTable, status: TableStatus) => void;
  onEdit: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
}) {
  const isOpenable = table.status === "free" || table.status === "occupied";
  const canShowBill = canBill && table.status === "occupied" && order?.status === "served";
  const itemCount = order?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Left accent bar — rendered as its own element (not a `border-l-*`
          utility) so it never has to fight the card's own `border-border`
          for who wins the left edge: Tailwind utility precedence between
          an all-sides `border-{color}` and a single-side `border-l-{color}`
          depends on generated stylesheet order, not JSX class order, so two
          classes both setting left-border-color would be a real bug risk. */}
      <span className={`absolute inset-y-0 left-0 w-1 ${STATUS_DOT[table.status]}`} aria-hidden />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-semibold text-text">{table.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-small text-text-muted">
            <ChairIcon className="h-3.5 w-3.5 shrink-0" />
            {table.seatingCapacity} seats
            {areaName && <span aria-hidden>&middot;</span>}
            {areaName && <span className="truncate">{areaName}</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2 text-small text-text-muted">
            <button type="button" onClick={() => onEdit(table)} className="hover:text-secondary">
              Edit
            </button>
            <button type="button" onClick={() => onDelete(table)} className="hover:text-error">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[table.status]}`} aria-hidden />
        <span className={`text-small font-medium ${STATUS_TEXT[table.status]}`}>
          {STATUS_LABEL[table.status]}
        </span>
      </div>

      {table.status === "occupied" && order && (
        <p className="text-small text-text-muted">
          {itemCount} item{itemCount === 1 ? "" : "s"} &middot;{" "}
          <span className="font-medium text-text">{formatMoney(order.subtotal)}</span>
        </p>
      )}

      {(isOpenable || canShowBill) && (
        <div className="mt-1 flex items-center gap-2">
          {isOpenable && (
            <button
              type="button"
              onClick={() => onOpen(table)}
              className="flex-1 rounded-lg border border-primary px-3 py-1.5 text-small font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Open
            </button>
          )}
          {canShowBill && order && (
            <button
              type="button"
              onClick={() => onBill(order)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary"
            >
              <ReceiptIcon className="h-3.5 w-3.5" />
              Bill
            </button>
          )}
        </div>
      )}

      {canChangeStatus && (
        <select
          value={table.status}
          onChange={(event) => onStatusChange(table, event.target.value as TableStatus)}
          aria-label={`Change status for ${table.name}`}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-small text-text"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
