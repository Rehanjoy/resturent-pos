"use client";

import type { FloorSession, FloorTable, FloorChairStatus } from "@/lib/tables/seating-admin-api";

const CHAIR_TONE: Record<FloorChairStatus, string> = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100",
  held: "border-amber-300 bg-amber-100 text-amber-950",
  occupied: "border-red-300 bg-red-50 text-red-900",
  cleaning: "border-sky-300 bg-sky-50 text-sky-900",
  unavailable: "border-gray-200 bg-gray-100 text-gray-500",
};

function sessionForChair(sessions: FloorSession[], tableId: string, chairNumber: number) {
  return sessions.find((session) =>
    session.seats.some((seat) => seat.tableId === tableId && seat.chairNumber === chairNumber),
  );
}

export function UnifiedTableMap({
  table,
  sessions,
  selected,
  attention,
  selectionPending,
  onChair,
  onTable,
}: {
  table: FloorTable;
  sessions: FloorSession[];
  selected: number[];
  attention: number[];
  selectionPending: boolean;
  onChair: (chairNumber: number, session?: FloorSession) => void;
  onTable: (session?: FloorSession) => void;
}) {
  const chairCount = table.chairs.length;
  const tableSessions = sessions.filter((session) =>
    session.seats.some((seat) => seat.tableId === table.id),
  );
  const singleTableSession = tableSessions.length === 1 ? tableSessions[0] : undefined;
  const wholeTableSession = tableSessions.find((session) => {
    const seatsAtTable = session.seats.filter((seat) => seat.tableId === table.id);
    return session.bookingMode === "whole_table" || seatsAtTable.length === chairCount;
  });
  const tableCleaning =
    table.wholeTableCleaning ||
    (table.status === "needs_cleaning" && tableSessions.length === 0) ||
    table.chairs.every((chair) => chair.status === "cleaning");
  const wholeTableOccupied =
    !tableCleaning &&
    ((table.status === "occupied" && tableSessions.length === 0) ||
      Boolean(wholeTableSession && wholeTableSession.status === "occupied"));
  const allAvailable = table.chairs.every((chair) => chair.status === "available");
  const allSelected = table.chairs.every((chair) => selected.includes(chair.number));
  const tableActionSession = tableCleaning ? singleTableSession : wholeTableSession;

  const topCount = chairCount <= 2 ? Math.min(1, chairCount) : Math.ceil((chairCount - (chairCount >= 4 ? 2 : 1)) / 2);
  const top = table.chairs.slice(0, topCount);
  const right = chairCount >= 4 ? table.chairs[topCount] : undefined;
  const bottomStart = topCount + (right ? 1 : 0);
  const bottom = table.chairs.slice(bottomStart, chairCount >= 3 ? -1 : undefined).reverse();
  const left = chairCount >= 3 ? table.chairs[chairCount - 1] : undefined;

  function chairButton(item: FloorTable["chairs"][number], direction: string) {
    const session = sessionForChair(tableSessions, table.id, item.number);
    const isSelected = selected.includes(item.number);
    const needsAttention = attention.includes(item.number);
    const canInteract = item.status !== "unavailable";
    return (
      <button
        key={item.number}
        type="button"
        disabled={!canInteract || selectionPending}
        onClick={() => onChair(item.number, session)}
        aria-pressed={isSelected}
        aria-label={`${table.name}, chair ${item.number}, ${isSelected ? "selected" : item.status}${needsAttention ? ", guest needs assistance" : ""}`}
        className={`floor-chair floor-chair-${direction} relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-semibold shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default ${isSelected ? "border-primary bg-primary text-white" : CHAIR_TONE[item.status]} ${needsAttention ? "service-pulse ring-2 ring-amber-500 ring-offset-2" : ""}`}
      >
        {item.number}
        <span className="sr-only"> {item.status}</span>
        {needsAttention && <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />}
      </button>
    );
  }

  const centerLabel = tableCleaning
    ? "Cleaning"
    : wholeTableOccupied
      ? "Whole table occupied"
      : allSelected
        ? "Whole table selected"
        : allAvailable
          ? "Select whole table"
          : "Choose a chair";

  return (
    <div className="overflow-x-auto py-2" role="group" aria-label={`${table.name} seating plan`}>
      <div className="mx-auto w-full max-w-80" style={{ minWidth: Math.max(224, topCount * 52 + 96) }}>
        <div className="mb-2 flex justify-center gap-1 px-12">{top.map((chair) => chairButton(chair, "top"))}</div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-12 shrink-0">{left && chairButton(left, "left")}</div>
          <button
            type="button"
            disabled={selectionPending || (!allAvailable && !wholeTableOccupied && !tableCleaning)}
            onClick={() => onTable(tableActionSession)}
            aria-pressed={allSelected}
            aria-label={`${table.name}: ${centerLabel}`}
            className={`floor-table relative flex min-h-32 flex-1 flex-col items-center justify-center border-4 px-3 py-4 text-center shadow-md transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-default ${table.shape === "round" ? "rounded-[50%]" : "rounded-3xl"} ${wholeTableOccupied ? "motion-safe:animate-pulse border-red-600 bg-red-100 text-red-950 shadow-red-200" : tableCleaning ? "border-sky-400 bg-sky-50 text-sky-950 shadow-sky-100" : allSelected ? "border-primary bg-orange-50 text-text shadow-orange-100" : "border-[#d9b89b] bg-[linear-gradient(135deg,#fff7ed_0%,#f2dcc7_48%,#fff7ed_100%)] text-text shadow-orange-100"}`}
          >
            <span aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 rounded-full border-2 border-white/90 bg-white/60 shadow-sm" />
            <span aria-hidden="true" className="absolute bottom-3 right-3 h-5 w-5 rounded-full border-2 border-white/90 bg-white/60 shadow-sm" />
            <strong className="relative font-heading text-lg font-semibold">{table.name}</strong>
            <span className={`relative mt-1 text-xs font-semibold ${wholeTableOccupied ? "text-red-800" : tableCleaning ? "text-sky-800" : "text-text-muted"}`}>
              {centerLabel}
            </span>
            {!wholeTableOccupied && !tableCleaning && (
              <span className="relative mt-1 text-[11px] text-text-muted">
                {table.chairs.filter((chair) => chair.status === "available").length}/{chairCount} available
              </span>
            )}
          </button>
          <div className="w-12 shrink-0">{right && chairButton(right, "right")}</div>
        </div>
        <div className="mt-3 flex justify-center gap-1 px-12">{bottom.map((chair) => chairButton(chair, "bottom"))}</div>
      </div>
    </div>
  );
}
