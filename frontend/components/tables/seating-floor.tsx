"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { seatingAdminApi, type FloorTable, type FloorSession, type SeatSelection } from "@/lib/tables/seating-admin-api";
import { TableSeatMap } from "@/components/dining/table-seat-map";
import type { DiningTable } from "@/lib/dining/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { HelpIcon, ReceiptIcon, WaterIcon } from "@/components/icons";

const chairStyle = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-800",
  held: "border-amber-300 bg-amber-50 text-amber-800",
  occupied: "border-orange-300 bg-orange-100 text-orange-900",
  unavailable: "border-border bg-gray-100 text-gray-500",
};
function QrSheet({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const query = useQuery({ queryKey: ["chair-qr", table.id], queryFn: () => seatingAdminApi.qr(table.id) });
  return <Modal title={`${table.name} · chair QR codes`} onClose={onClose}>
    <p className="mb-4 text-sm text-text-muted">Place one code on each chair. Guests can choose other available chairs or tables after scanning.</p>
    {query.isLoading && <p>Generating QR codes…</p>}{query.isError && <p role="alert" className="text-error">{query.error.message}</p>}
    <div className="grid grid-cols-2 gap-3">{query.data?.codes.map(code => <div key={code.chairNumber} className="rounded-2xl border border-border p-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- server generated SVG rendered as an inert image */}
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.svg)}`} alt={`${table.name}, chair ${code.chairNumber} QR`} className="mx-auto aspect-square w-full max-w-44" />
      <h3 className="my-2 text-sm font-semibold">{table.name} · Chair {code.chairNumber}</h3>
      <div className="flex flex-wrap justify-center gap-3 text-sm"><a className="text-primary underline" href={code.url} target="_blank" rel="noreferrer">Open</a><a className="text-primary underline" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.svg)}`} download={`${table.name}-chair-${code.chairNumber}.svg`}>Download</a></div>
    </div>)}</div>
  </Modal>;
}

function ReleaseGroup({ session, onClose, onRelease, pending, error }: { session: FloorSession; onClose: () => void; onRelease: (reason: string) => void; pending: boolean; error?: string }) {
  const [reason, setReason] = useState("");
  return <Modal title="Release this group's chairs" onClose={onClose}><form onSubmit={event => { event.preventDefault(); onRelease(reason); }} className="space-y-4">
    <p className="text-sm text-text-muted">Release {session.seats.length} chairs after the guests leave and the seats are clean. Other groups at the same table keep their seats. Any unpaid bill must be settled first.</p>
    <label className="block text-sm font-medium">Release reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={300} required placeholder="Guests left; chairs cleaned" className="mt-2 w-full rounded-xl border border-border p-3" /></label>
    {error && <p role="alert" className="text-error">{error}</p>}
    <button disabled={pending} className="w-full rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Releasing…" : "Release chairs"}</button>
  </form></Modal>;
}

export function SeatingFloor({ areaId, canManage, canBook, search }: { areaId: string | null; canManage: boolean; canBook: boolean; search: string }) {
  const cache = useQueryClient();
  const router = useRouter();
  const floor = useQuery({ queryKey: ["dining-floor"], queryFn: seatingAdminApi.get, refetchInterval: 5000 });
  const requests = useQuery({ queryKey: ["service-requests"], queryFn: seatingAdminApi.requests, refetchInterval: 5000 });
  const [selected, setSelected] = useState<SeatSelection[]>([]);
  const [partySize, setPartySize] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [qrTable, setQrTable] = useState<FloorTable | null>(null);
  const [releaseGroup, setReleaseGroup] = useState<FloorSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const refresh = () => { cache.invalidateQueries({ queryKey: ["dining-floor"] }); cache.invalidateQueries({ queryKey: ["tables"] }); };
  const hold = useMutation({ mutationFn: () => seatingAdminApi.hold(partySize, selected, { name: guestName.trim(), phone: guestPhone.trim() }), onSuccess: () => { setSelected([]); setGuestName(""); setGuestPhone(""); refresh(); } });
  const updateRequest = useMutation({ mutationFn: ({ id, status }: { id: string; status: "acknowledged" | "completed" }) => seatingAdminApi.updateRequest(id, status), onSuccess: () => cache.invalidateQueries({ queryKey: ["service-requests"] }) });
  const release = useMutation({ mutationFn: (reason: string) => seatingAdminApi.release(releaseGroup!.id, reason), onSuccess: () => { setReleaseGroup(null); refresh(); } });
  const openOrder = useMutation({ mutationFn: seatingAdminApi.order, onSuccess: ({ order }) => router.push(`/admin/orders/active?tableId=${order.tableId}&orderId=${order.id}`) });
  const tables = floor.data?.tables ?? [];
  const visible = tables.filter(table => (!areaId || table.areaId === areaId) && table.name.toLowerCase().includes(search.toLowerCase()));
  const selectedHas = (tableId: string, chairNumber: number) => selected.some(seat => seat.tableId === tableId && seat.chairNumber === chairNumber);
  function toggleSeat(tableId: string, chairNumber: number) {
    setSelected(current => selectedHas(tableId, chairNumber) ? current.filter(seat => !(seat.tableId === tableId && seat.chairNumber === chairNumber)) : [...current, { tableId, chairNumber }]);
  }
  const staleSelection = selected.some(seat => tables.find(table => table.id === seat.tableId)?.chairs.find(chair => chair.number === seat.chairNumber)?.status !== "available");
  const totalAvailable = tables.flatMap(table => table.chairs).filter(chair => chair.status === "available").length;
  const sessions = (floor.data?.sessions ?? []).filter(session => ["held", "occupied"].includes(session.status));
  useSocketEvent("service:updated", () => { cache.invalidateQueries({ queryKey: ["service-requests"] }); cache.invalidateQueries({ queryKey: ["dining-floor"] }); });
  const activeRequests = requests.data ?? [];
  const attentionByTable = new Map<string, number[]>();
  for (const request of activeRequests) for (const seat of request.seats) attentionByTable.set(seat.tableId, [...new Set([...(attentionByTable.get(seat.tableId) ?? []), seat.chairNumber])]);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Live seating</h2><p className="text-sm text-text-muted">{totalAvailable} chairs available · Updates every 5 seconds</p></div><div className="flex flex-wrap gap-3 text-xs">{Object.entries(chairStyle).map(([status, style]) => <span key={status} className="flex items-center gap-1.5 capitalize"><i className={`h-3 w-3 rounded border ${style}`} />{status}</span>)}</div></div>
    {activeRequests.length > 0 && <section aria-label="Guest service requests" className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-amber-950">Guest requests</h3><span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">{activeRequests.length} open</span></div><div className="grid gap-2 md:grid-cols-2">{activeRequests.map(request => { const RequestIcon = request.type === "water" ? WaterIcon : request.type === "bill" ? ReceiptIcon : HelpIcon; return <div key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"><RequestIcon className="h-6 w-6 text-amber-800" /><div className="min-w-0 flex-1"><strong className="block text-sm capitalize">{request.type === "help" ? "Waiter help" : request.type}</strong><span className="text-xs text-text-muted">{request.seats.map(seat => `${seat.tableName} / C${seat.chairNumber}`).join(" · ")}</span></div>{request.status === "pending" ? <button disabled={updateRequest.isPending} onClick={() => updateRequest.mutate({ id: request.id, status: "acknowledged" })} className="min-h-11 rounded-full bg-amber-500 px-4 text-xs font-semibold text-amber-950">I’m going</button> : <button disabled={updateRequest.isPending} onClick={() => updateRequest.mutate({ id: request.id, status: "completed" })} className="min-h-11 rounded-full bg-success px-4 text-xs font-semibold text-white">Done</button>}</div>; })}</div></section>}
    {floor.isLoading && <p>Loading chair availability…</p>}
    {floor.isError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-error">{floor.error.message}<button onClick={() => floor.refetch()} className="ml-3 underline">Retry</button></div>}
    {!floor.isLoading && !floor.isError && visible.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-text-muted">No tables match this area or search.</p>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visible.map(table => {
      const allAvailable = table.chairs.every(chair => chair.status === "available");
      return <article key={table.id} className="rounded-2xl border border-border bg-white p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2"><span className="text-xs text-text-muted">{table.areaName}</span>{canManage && <button onClick={() => setQrTable(table)} className="min-h-11 text-xs font-semibold text-primary">QR codes</button>}</div>
        <TableSeatMap table={table as DiningTable} selected={selected.filter(seat => seat.tableId === table.id).map(seat => seat.chairNumber)} attention={attentionByTable.get(table.id) ?? []} disabled={(_number, status) => !canBook || status !== "available" || hold.isPending} onChair={number => toggleSeat(table.id, number)} />
        {canBook && <button disabled={!allAvailable || hold.isPending} onClick={() => setSelected(current => [...current.filter(seat => seat.tableId !== table.id), ...table.chairs.map(chair => ({ tableId: table.id, chairNumber: chair.number }))])} className="mt-3 min-h-11 w-full rounded-full border border-border px-2 text-xs font-medium disabled:opacity-40">Select whole table</button>}
      </article>;
    })}</div>
    {canBook && <div className="space-y-3 rounded-2xl border border-orange-200 bg-white p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Guest name<input value={guestName} onChange={event => setGuestName(event.target.value)} minLength={2} maxLength={100} placeholder="Booking name" className="mt-1 block min-h-11 w-full rounded-xl border border-border px-3" /></label><label className="text-sm font-medium">Mobile number<input type="tel" value={guestPhone} onChange={event => setGuestPhone(event.target.value)} placeholder="98765 43210" className="mt-1 block min-h-11 w-full rounded-xl border border-border px-3" /></label><label className="text-sm font-medium">Party size<input type="number" min="1" max="50" required value={partySize} onChange={event => setPartySize(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-xl border border-border px-3" /></label></div><div className="flex flex-wrap items-end gap-4"><div className="min-w-0 flex-1"><p className="font-semibold">{selected.length} chairs selected</p><p className="text-xs text-text-muted">Select chairs across tables for larger parties. Staff bookings have no timer.</p></div><button onClick={() => hold.mutate()} disabled={hold.isPending || selected.length < partySize || staleSelection || partySize < 1 || guestName.trim().length < 2 || !/^(?:[6-9]\d{9}|\+[1-9]\d{7,14})$/.test(guestPhone.replace(/[\s()-]/g, ""))} className="min-h-11 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{hold.isPending ? "Booking…" : "Book for guests"}</button>{selected.length > 0 && <button onClick={() => setSelected([])} className="min-h-11 text-sm text-text-muted underline">Clear</button>}</div>
      {selected.length > 0 && <p className="text-xs text-text-muted">{selected.map(seat => `${tables.find(t => t.id === seat.tableId)?.name} / C${seat.chairNumber}`).join(" · ")}</p>}
      {staleSelection && <p role="alert" className="text-sm text-error">A selected chair is no longer available. Clear and choose the available seats.</p>}
      {hold.isError && <p role="alert" className="text-sm text-error">{hold.error.message}</p>}{hold.isSuccess && <p role="status" className="text-sm text-success">Seats booked. Use Take order below for this group; release seats after their visit.</p>}
    </div>}
    {openOrder.isError && <p role="alert" className="text-sm text-error">{openOrder.error.message}</p>}
    <div className="space-y-3"><h3 className="font-semibold">Seated groups & active holds <span className="text-text-muted">({sessions.length})</span></h3>{sessions.length === 0 && !floor.isLoading && <p className="rounded-xl bg-white p-4 text-sm text-text-muted">No active groups yet.</p>}{sessions.map(session => {
      const remaining = session.expiresAt ? Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now) / 1000)) : null;
      return <div key={session.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{session.customer?.name ?? `${session.partySize} guests`} <span className="text-xs font-normal text-text-muted">· {session.partySize} guests · {session.source === "staff" ? "Staff booking" : "QR booking"}</span></p><p className="mt-1 text-xs text-text-muted">{session.seats.map(seat => `${tables.find(table => table.id === seat.tableId)?.name ?? "Table"} / C${seat.chairNumber}`).join(" · ")}</p></div><span className={`rounded-full px-3 py-2 text-xs font-semibold tabular-nums ${remaining === null ? "bg-orange-50 text-orange-800" : "bg-amber-50 text-amber-800"}`}>{remaining === null ? "Occupied · manual release" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} hold`}</span>{session.orderId && <Link className="min-h-11 rounded-full border border-border px-4 py-3 text-xs font-semibold" href={`/admin/orders/active?tableId=${session.seats[0]?.tableId}&orderId=${session.orderId}`}>View order</Link>}{canBook && !session.orderId && session.source === "staff" && <button disabled={openOrder.isPending} onClick={() => openOrder.mutate(session.id)} className="min-h-11 rounded-full bg-primary px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">Take order</button>}{canBook && <button onClick={() => { release.reset(); setReleaseGroup(session); }} className="min-h-11 px-2 text-xs font-semibold text-primary">Release</button>}</div>;
    })}</div>
    {qrTable && <QrSheet table={qrTable} onClose={() => setQrTable(null)} />}
    {releaseGroup && <ReleaseGroup session={releaseGroup} onClose={() => setReleaseGroup(null)} onRelease={reason => release.mutate(reason)} pending={release.isPending} error={release.isError ? release.error.message : undefined} />}
  </section>;
}
