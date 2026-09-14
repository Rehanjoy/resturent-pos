"use client";

import { useState } from "react";
import type { DiningContext, DiningSeat } from "@/lib/dining/types";
import { TableSeatMap } from "./table-seat-map";

export function SeatSelection({ context, busy, onReserve }: { context: DiningContext; busy: boolean; onReserve: (partySize: number, seats: DiningSeat[]) => void }) {
  const [partySize, setPartySize] = useState(1);
  const [seats, setSeats] = useState<DiningSeat[]>([]);
  const [mode, setMode] = useState<"chairs" | "table">("chairs");
  const [area, setArea] = useState("all");
  const areas = Array.from(new Map(context.tables.map((table) => [table.areaId, table.areaName])).entries());
  const hasSeat = (tableId: string, chairNumber: number) => seats.some((seat) => seat.tableId === tableId && seat.chairNumber === chairNumber);
  const selectionAvailable = seats.every((seat) => context.tables.find((table) => table.id === seat.tableId)?.chairs.some((chair) => chair.number === seat.chairNumber && chair.status === "available"));
  const totalAvailable = context.tables.reduce((sum, table) => sum + table.chairs.filter((chair) => chair.status === "available").length, 0);
  return <section className="mx-auto max-w-4xl pb-28">
    <div className="mb-6 rounded-3xl bg-surface p-5 sm:p-7"><p className="mb-2 text-sm font-semibold text-primary">MAKE YOURSELF COMFORTABLE</p><h1 className="font-heading text-2xl font-semibold sm:text-3xl">A place for everyone.</h1><p className="mt-2 text-sm text-text-muted">You scanned {context.scanned.tableName}{context.scanned.chairNumber ? ` · Chair ${context.scanned.chairNumber}` : ""}. Choose your seats below — your group can sit across tables.</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-3 font-semibold">How many guests?<input type="number" inputMode="numeric" min={1} max={50} value={partySize} onChange={(event) => { setPartySize(Math.min(50, Math.max(1, Number(event.target.value) || 1))); setSeats([]); }} className="h-12 w-20 rounded-xl border border-border bg-background px-3 text-center text-lg" /></label><div className="flex rounded-full bg-background p-1">{(["chairs", "table"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setSeats([]); }} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${mode === value ? "bg-text text-white" : "text-text-muted"}`}>{value === "chairs" ? "Choose chairs" : "Whole tables"}</button>)}</div></div>
      <p className="mt-4 text-xs leading-relaxed text-text-muted">Seats are held for {context.policy.holdMinutes} minutes. Place an order before the timer ends to keep them. Waiter bookings stay occupied until staff releases them.</p>
    </div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2"><button type="button" onClick={() => setArea("all")} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${area === "all" ? "border-primary bg-surface text-primary" : "border-transparent bg-surface"}`}>All floors</button>{areas.map(([id, name]) => <button key={id} type="button" onClick={() => setArea(id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${area === id ? "border-primary bg-surface text-primary" : "border-transparent bg-surface"}`}>{name}</button>)}</div>
    <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-text-muted"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-success" />Available</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />Your selection</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-text-muted/40" />Occupied / held</span></div>
    {totalAvailable < partySize && <p role="status" className="mb-4 rounded-xl bg-warning/10 p-4 text-sm">Only {totalAvailable} chairs are available right now. Please ask your waiter for help with a larger group.</p>}
    {!context.tables.length && <div className="rounded-2xl bg-surface p-8 text-center text-text-muted">No seating is available yet. Please speak with your waiter.</div>}
    <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-3">{context.tables.filter((table) => area === "all" || table.areaId === area).map((table) => {
      const available = table.chairs.filter((chair) => chair.status === "available");
      const selected = seats.filter((seat) => seat.tableId === table.id).length;
      return <article key={table.id} className={`rounded-3xl border bg-surface p-3 sm:p-5 ${selected ? "border-primary" : "border-transparent"}`}>
        <div className="flex items-center justify-between text-xs"><span className="text-text-muted">{table.areaName}</span>{table.id === context.scanned.tableId && <span className="font-semibold text-primary">Scanned table</span>}</div>
        <TableSeatMap table={table} selected={seats.filter(seat => seat.tableId === table.id).map(seat => seat.chairNumber)} scannedChair={table.id === context.scanned.tableId ? context.scanned.chairNumber : null} disabled={(number, status) => busy || mode === "table" || (!hasSeat(table.id, number) && (status !== "available" || seats.length >= partySize))} onChair={number => setSeats(current => hasSeat(table.id, number) ? current.filter(seat => !(seat.tableId === table.id && seat.chairNumber === number)) : [...current, { tableId: table.id, chairNumber: number }])} />
        {mode === "table" && <button type="button" disabled={!selected && available.length !== table.seatingCapacity} onClick={() => setSeats((current) => selected ? current.filter((seat) => seat.tableId !== table.id) : [...current, ...available.map((chair) => ({ tableId: table.id, chairNumber: chair.number }))])} className={`mt-3 min-h-11 w-full rounded-full border px-2 text-xs font-semibold disabled:opacity-40 ${selected ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{selected ? "Remove table" : available.length === table.seatingCapacity ? "Select whole table" : "Partly occupied"}</button>}
      </article>;
    })}</div>
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><div className="mx-auto flex max-w-4xl items-center gap-4"><div className="min-w-0 flex-1"><strong className="block text-sm">{seats.length} seats · {partySize} guests</strong><span className="text-xs text-text-muted">{!selectionAvailable ? "Some selected chairs were just reserved. Remove them to continue." : seats.length < partySize ? `Choose ${partySize - seats.length} more` : "Ready to reserve"}</span></div><button type="button" disabled={busy || !selectionAvailable || seats.length < partySize || seats.length > 50} onClick={() => onReserve(partySize, seats)} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-white disabled:opacity-40">{busy ? "Reserving…" : "Reserve seats"}</button></div></div>
  </section>;
}
