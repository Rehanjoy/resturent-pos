"use client";

import type { RestaurantTable, TableStatus } from "@/lib/tables/types";

const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Free",
  occupied: "Occupied",
  reserved: "Reserved",
  needs_cleaning: "Needs Cleaning",
};

// Semantic tokens from docs/02-brand-kit.md — free reads as "on time"
// (success), occupied uses the brand coral (primary), reserved uses info
// blue, needs_cleaning uses the warning amber. Never ad-hoc hex values.
const STATUS_STYLES: Record<TableStatus, string> = {
  free: "border-success text-success bg-success/10",
  occupied: "border-primary text-primary bg-primary/10",
  reserved: "border-info text-info bg-info/10",
  needs_cleaning: "border-warning text-warning bg-warning/10",
};

const STATUS_OPTIONS: TableStatus[] = ["free", "occupied", "reserved", "needs_cleaning"];

export function TableCard({
  table,
  canManage,
  canChangeStatus,
  onNavigate,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  table: RestaurantTable;
  canManage: boolean;
  canChangeStatus: boolean;
  onNavigate: (table: RestaurantTable) => void;
  onStatusChange: (table: RestaurantTable, status: TableStatus) => void;
  onEdit: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
}) {
  const isNavigable = table.status === "free" || table.status === "occupied";

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-sm ${
        isNavigable ? "cursor-pointer hover:shadow-md" : ""
      }`}
      onClick={() => isNavigable && onNavigate(table)}
      role={isNavigable ? "button" : undefined}
      tabIndex={isNavigable ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-text">{table.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-small text-text-muted">
            <span aria-hidden>{table.shape === "round" ? "○" : "□"}</span>
            {table.seatingCapacity} seats
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 text-small text-text-muted">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(table);
              }}
              className="hover:text-secondary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(table);
              }}
              className="hover:text-error"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <span
        className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-small font-medium ${STATUS_STYLES[table.status]}`}
      >
        {STATUS_LABEL[table.status]}
      </span>

      {canChangeStatus && (
        <select
          value={table.status}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onStatusChange(table, event.target.value as TableStatus)
          }
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
