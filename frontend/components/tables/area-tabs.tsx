"use client";

import type { Area } from "@/lib/tables/types";

export function AreaTabs({
  areas,
  activeAreaId,
  onSelect,
  canManage,
  onAddArea,
  onEditArea,
  onDeleteArea,
}: {
  areas: Area[];
  activeAreaId: string | null;
  onSelect: (areaId: string | null) => void;
  canManage: boolean;
  onAddArea: () => void;
  onEditArea: (area: Area) => void;
  onDeleteArea: (area: Area) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
          activeAreaId === null
            ? "border border-primary text-primary"
            : "border border-border text-text-muted hover:text-text"
        }`}
      >
        All
      </button>

      {areas.map((area) => (
        <div key={area.id} className="relative flex items-center">
          <button
            type="button"
            onClick={() => onSelect(area.id)}
            className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
              activeAreaId === area.id
                ? "border border-primary text-primary"
                : "border border-border text-text-muted hover:text-text"
            }`}
          >
            {area.name}
          </button>
          {/* Always visible (not hover-only) — this screen runs on
              touch-only POS/KDS tablets (PRD §7), which have no hover
              state, so a `group-hover` reveal would make these
              unreachable there. */}
          {canManage && (
            <span className="ml-1 flex gap-1.5">
              <button
                type="button"
                onClick={() => onEditArea(area)}
                aria-label={`Edit ${area.name}`}
                className="text-small text-text-muted transition-colors hover:text-secondary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteArea(area)}
                aria-label={`Delete ${area.name}`}
                className="text-small text-text-muted transition-colors hover:text-error"
              >
                Delete
              </button>
            </span>
          )}
        </div>
      ))}

      {canManage && (
        <button
          type="button"
          onClick={onAddArea}
          className="rounded-full border border-dashed border-border px-4 py-1.5 text-small font-medium text-text-muted hover:border-primary hover:text-primary"
        >
          + Add Area
        </button>
      )}
    </div>
  );
}
