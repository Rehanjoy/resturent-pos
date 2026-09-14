"use client";

import type { DiningTable } from "@/lib/dining/types";

const tones = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-900",
  held: "border-amber-300 bg-amber-100 text-amber-900",
  occupied: "border-orange-300 bg-orange-100 text-orange-900",
  cleaning: "border-sky-300 bg-sky-50 text-sky-900",
  unavailable: "border-gray-200 bg-gray-100 text-gray-500",
};

/** A top-down floor symbol; every chair remains a real, labelled 44px button. */
export function TableSeatMap({ table, selected = [], attention = [], scannedChair, disabled, onChair }: {
  table: DiningTable; selected?: number[]; attention?: number[]; scannedChair?: number | null;
  disabled?: (number: number, status: DiningTable["chairs"][number]["status"]) => boolean;
  onChair?: (number: number) => void;
}) {
  const count = table.chairs.length;
  const topCount = count <= 2 ? Math.min(1, count) : Math.ceil((count - (count >= 4 ? 2 : 1)) / 2);
  const top = table.chairs.slice(0, topCount);
  const right = count >= 4 ? table.chairs[topCount] : undefined;
  const bottomStart = topCount + (right ? 1 : 0);
  const bottom = table.chairs.slice(bottomStart, count >= 3 ? -1 : undefined).reverse();
  const left = count >= 3 ? table.chairs[count - 1] : undefined;
  const chair = (item: DiningTable["chairs"][number], direction: string) => <button
    key={item.number} type="button" onClick={() => onChair?.(item.number)}
    disabled={!onChair || disabled?.(item.number, item.status)} aria-pressed={selected.includes(item.number)}
    aria-label={`${table.name}, chair ${item.number}, ${selected.includes(item.number) ? "selected" : item.status}${scannedChair === item.number ? ", scanned chair" : ""}${attention.includes(item.number) ? ", guest needs assistance" : ""}`}
    className={`floor-chair floor-chair-${direction} relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default ${selected.includes(item.number) ? "border-primary bg-primary text-white" : tones[item.status]} ${attention.includes(item.number) ? "service-pulse ring-2 ring-amber-500 ring-offset-2" : ""}`}>
    {item.number}{scannedChair === item.number && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />}
  </button>;
  return <div className="overflow-x-auto py-3" role="group" aria-label={`${table.name} seating plan`}>
    <div className="mx-auto w-full max-w-80" style={{ minWidth: Math.max(208, topCount * 48 + 88) }}>
      <div className="mb-2 flex justify-center gap-1 px-11">{top.map(item => chair(item, "top"))}</div>
      <div className="flex items-center justify-center gap-2">
        <div className="w-11 shrink-0">{left && chair(left, "left")}</div>
        <div className={`floor-table relative flex min-h-28 flex-1 flex-col items-center justify-center border-4 px-2 py-4 text-center ${table.shape === "round" ? "rounded-[50%]" : "rounded-2xl"} ${attention.length ? "ring-2 ring-amber-500 ring-offset-4" : ""}`}>
          <span aria-hidden="true" className="absolute left-2 top-2 h-5 w-5 rounded-full border-2 border-white/90 bg-white/50 shadow-sm" />
          <span aria-hidden="true" className="absolute bottom-2 right-2 h-5 w-5 rounded-full border-2 border-white/90 bg-white/50 shadow-sm" />
          <h3 className="relative font-heading text-lg font-semibold text-text">{table.name}</h3>
          <span className="relative mt-1 text-xs font-medium text-text-muted">{table.chairs.filter(item => item.status === "available").length}/{count} free</span>
        </div>
        <div className="w-11 shrink-0">{right && chair(right, "right")}</div>
      </div>
      <div className="mt-3 flex justify-center gap-1 px-11">{bottom.map(item => chair(item, "bottom"))}</div>
    </div>
  </div>;
}
