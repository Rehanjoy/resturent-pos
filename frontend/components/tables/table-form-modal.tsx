"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Area, RestaurantTable, TableShape } from "@/lib/tables/types";

export function TableFormModal({
  table,
  areas,
  defaultAreaId,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  table: RestaurantTable | null;
  areas: Area[];
  defaultAreaId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    areaId: string;
    name: string;
    seatingCapacity: number;
    shape: TableShape;
  }) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [areaId, setAreaId] = useState(
    table?.areaId ?? defaultAreaId ?? areas[0]?.id ?? "",
  );
  const [name, setName] = useState(table?.name ?? "");
  const [seatingCapacity, setSeatingCapacity] = useState(
    table ? String(table.seatingCapacity) : "4",
  );
  const [shape, setShape] = useState<TableShape>(table?.shape ?? "square");

  return (
    <Modal title={table ? "Edit Table" : "Add Table"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            areaId,
            name: name.trim(),
            seatingCapacity: Number(seatingCapacity),
            shape,
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Area</span>
          <select
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            required
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          >
            {areas.length === 0 && <option value="">No areas yet</option>}
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Table name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. T-12"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Seating capacity</span>
          <input
            type="number"
            min={1}
            value={seatingCapacity}
            onChange={(event) => setSeatingCapacity(event.target.value)}
            required
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Shape</span>
          <select
            value={shape}
            onChange={(event) => setShape(event.target.value as TableShape)}
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          >
            <option value="square">Square</option>
            <option value="round">Round</option>
          </select>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !areaId}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
