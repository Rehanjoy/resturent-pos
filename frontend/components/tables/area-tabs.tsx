"use client";

import type { Area } from "@/lib/tables/types";
import { Button } from "@/components/ui/button";

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
  const activeArea = areas.find((area) => area.id === activeAreaId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Dining areas">
        <Button
          type="button"
          variant="outline"
          role="tab"
          aria-selected={activeAreaId === null}
          onClick={() => onSelect(null)}
          className={activeAreaId === null ? "border-primary bg-primary text-white hover:border-primary hover:text-white" : "border-border text-text-muted"}
        >
          All areas
        </Button>

        {areas.map((area) => (
          <Button
            key={area.id}
            type="button"
            variant="outline"
            role="tab"
            aria-selected={activeAreaId === area.id}
            onClick={() => onSelect(area.id)}
            className={activeAreaId === area.id ? "border-primary bg-primary text-white hover:border-primary hover:text-white" : "border-border text-text-muted"}
          >
            {area.name}
          </Button>
        ))}
      </div>

      {canManage && (
        <div className="flex shrink-0 items-center gap-2">
          {activeArea && (
            <>
              <Button type="button" variant="ghost" onClick={() => onEditArea(activeArea)} className="hover:bg-surface hover:text-secondary">
                Edit area
              </Button>
              <Button type="button" variant="ghost" onClick={() => onDeleteArea(activeArea)} className="hover:bg-red-50 hover:text-error">
                Delete area
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={onAddArea} className="border-dashed border-primary text-primary hover:border-primary hover:text-primary">
            + Add area
          </Button>
        </div>
      )}
    </div>
  );
}
