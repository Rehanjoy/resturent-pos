import type { RestaurantTable, TableStatus } from "@/lib/tables/types";

const CHIP_ORDER: TableStatus[] = ["free", "occupied", "reserved", "needs_cleaning"];

// "Available" reads better than the raw "free" enum value to a restaurant
// staff member glancing at the floor; "Cleaning" is the short form of
// "needs_cleaning" the task's mapping note asks for. Same 4-value enum as
// `lib/tables/types.ts` — nothing invented here.
const CHIP_LABEL: Record<TableStatus, string> = {
  free: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  needs_cleaning: "Cleaning",
};

const CHIP_DOT: Record<TableStatus, string> = {
  free: "bg-success",
  occupied: "bg-primary",
  reserved: "bg-info",
  needs_cleaning: "bg-warning",
};

/**
 * Header stat chips for the Floor & Tables screen — a quick "how's the
 * floor doing" read at a glance. Computed straight from the same `tables`
 * list the grid below renders (no extra fetch, no separate cache to keep
 * in sync). Read-only by design; the per-table status control further down
 * the screen is still the only way status actually changes.
 */
export function TableStatChips({ tables }: { tables: RestaurantTable[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CHIP_ORDER.map((status) => {
        const count = tables.filter((table) => table.status === status).length;
        return (
          <span
            key={status}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-small font-medium text-text shadow-sm"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${CHIP_DOT[status]}`} aria-hidden />
            {CHIP_LABEL[status]}
            <span className="text-text-muted">{count}</span>
          </span>
        );
      })}
    </div>
  );
}
