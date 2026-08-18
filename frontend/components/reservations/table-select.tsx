"use client";

import type { Area, RestaurantTable } from "@/lib/tables/types";

/**
 * Table dropdown grouped by area — "T1 · 2 seats · AC Indoor" per option,
 * mirroring the client reference's grouped list. Reused by both the New
 * Reservation modal and the Seat modal so the same options/labels/grouping
 * never drift between the two. Reuses `GET /api/tables` + `GET /api/areas`
 * data the Tables screen already consumes — no new endpoint.
 */
export function TableSelect({
  tables,
  areas,
  value,
  onChange,
  allowNone = true,
  id,
}: {
  tables: RestaurantTable[];
  areas: Area[];
  value: string;
  onChange: (tableId: string) => void;
  allowNone?: boolean;
  id?: string;
}) {
  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
  const areasWithTables = areas
    .map((area) => ({
      area,
      tables: tables.filter((table) => table.areaId === area.id).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.tables.length > 0);

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-border px-3 py-2 text-body text-text"
    >
      {allowNone && <option value="">No table yet</option>}
      {areasWithTables.map(({ area, tables: areaTables }) => (
        <optgroup key={area.id} label={areaNameById.get(area.id) ?? area.name}>
          {areaTables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name} · {table.seatingCapacity} seats · {areaNameById.get(table.areaId)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
