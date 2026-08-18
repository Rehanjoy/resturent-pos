"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Area } from "@/lib/tables/types";

export function AreaFormModal({
  area,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  area: Area | null;
  onClose: () => void;
  onSubmit: (input: { name: string; displayOrder?: number }) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [name, setName] = useState(area?.name ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    area?.displayOrder !== undefined ? String(area.displayOrder) : "0",
  );

  return (
    <Modal title={area ? "Edit Area" : "Add Area"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name: name.trim(),
            displayOrder: displayOrder ? Number(displayOrder) : undefined,
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Area name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. AC Indoor"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Display order</span>
          <input
            type="number"
            min={0}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
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
            disabled={isSubmitting || !name.trim()}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
