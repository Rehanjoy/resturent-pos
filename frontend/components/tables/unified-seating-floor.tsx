"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  seatingAdminApi,
  type BookingMode,
  type FloorChairStatus,
  type FloorServiceRequest,
  type FloorSession,
  type FloorTable,
  type SeatSelection,
} from "@/lib/tables/seating-admin-api";
import type { RestaurantTable } from "@/lib/tables/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { BroomIcon, HelpIcon, ReceiptIcon, WaterIcon } from "@/components/icons";
import { UnifiedTableMap } from "./unified-table-map";

const STATUS_META: Record<FloorChairStatus, { label: string; dot: string }> = {
  available: { label: "Available", dot: "bg-success" },
  held: { label: "Held", dot: "bg-warning" },
  occupied: { label: "Occupied", dot: "bg-error" },
  cleaning: { label: "Cleaning", dot: "bg-info" },
  unavailable: { label: "Unavailable", dot: "bg-gray-400" },
};

function QrSheet({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["chair-qr", table.id],
    queryFn: () => seatingAdminApi.qr(table.id),
  });

  return (
    <Modal title={`${table.name} · chair QR codes`} onClose={onClose}>
      <p className="mb-4 text-sm text-text-muted">
        Place one code on each chair. A guest can reserve that chair, choose more chairs, or select an
        available whole table.
      </p>
      {query.isLoading && (
        <div role="status" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2].map((key) => <Skeleton key={key} className="aspect-square w-full rounded-2xl" />)}
        </div>
      )}
      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {query.data?.codes.map((code) => (
          <Card key={code.chairNumber} className="p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- server generated SVG rendered as an inert image */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.svg)}`}
              alt={`${table.name}, chair ${code.chairNumber} QR`}
              className="mx-auto aspect-square w-full max-w-44"
            />
            <h3 className="my-2 text-sm font-semibold">{table.name} · Chair {code.chairNumber}</h3>
            <div className="flex justify-center gap-4 text-sm">
              <a className="min-h-11 py-3 font-semibold text-primary underline" href={code.url} target="_blank" rel="noreferrer">Open</a>
              <a className="min-h-11 py-3 font-semibold text-primary underline" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.svg)}`} download={`${table.name}-chair-${code.chairNumber}.svg`}>Download</a>
            </div>
          </Card>
        ))}
      </div>
    </Modal>
  );
}

function ReleaseGroup({
  session,
  onClose,
  onRelease,
  pending,
  error,
}: {
  session: FloorSession;
  onClose: () => void;
  onRelease: (reason: string) => void;
  pending: boolean;
  error?: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title="Release this seating" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onRelease(reason); }} className="space-y-4">
        <p className="text-sm text-text-muted">
          Release {session.seats.length} chair{session.seats.length === 1 ? "" : "s"} only when guests
          leave without a payment flow. A paid visit moves to Cleaning automatically.
        </p>
        <div>
          <Label htmlFor="release-reason" className="mb-2">Release reason</Label>
          <textarea
            id="release-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={300}
            required
            placeholder="Guests moved to another table"
            className="mt-2 min-h-24 w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus-visible:border-primary"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Releasing…" : "Release seating"}
        </Button>
      </form>
    </Modal>
  );
}

function SeatingDetails({
  session,
  table,
  chairNumber,
  onClose,
  onMarkAvailable,
  pending,
  error,
}: {
  session: FloorSession;
  table: FloorTable;
  chairNumber?: number;
  onClose: () => void;
  onMarkAvailable: () => void;
  pending: boolean;
  error?: string;
}) {
  const isCleaning = session.status === "cleaning";
  const seats = session.seats
    .map((seat) => `${seat.tableId === table.id ? table.name : "Table"} · C${seat.chairNumber}`)
    .join(" · ");

  return (
    <Modal title={isCleaning ? "Cleaning check" : "Guest seating"} onClose={onClose}>
      <div className="space-y-4">
        <div className={`rounded-2xl border p-4 ${isCleaning ? "border-sky-200 bg-sky-50" : "border-border bg-[#fffaf8]"}`}>
          <div className="flex items-start gap-3">
            {isCleaning && <span className="rounded-xl bg-white p-2 text-info"><BroomIcon className="h-6 w-6" /></span>}
            <div>
              <h3 className="font-heading text-lg font-semibold">
                {chairNumber ? `${table.name} · Chair ${chairNumber}` : table.name}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {isCleaning ? "Payment completed · waiting for cleaning" : session.customer?.name ?? `${session.partySize} guests`}
              </p>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border p-3"><dt className="text-xs text-text-muted">Booking</dt><dd className="mt-1 font-semibold">{session.bookingMode === "whole_table" ? "Whole table" : `${session.seats.length} chair${session.seats.length === 1 ? "" : "s"}`}</dd></div>
          <div className="rounded-xl border border-border p-3"><dt className="text-xs text-text-muted">Waiter</dt><dd className="mt-1 font-semibold">{session.assignedWaiter?.name ?? "Not assigned yet"}</dd></div>
        </dl>
        <p className="text-xs leading-5 text-text-muted">{seats}</p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isCleaning ? (
          <Button type="button" size="lg" disabled={pending} onClick={onMarkAvailable} className="w-full bg-success text-white hover:bg-success/90">
            {pending ? "Updating…" : "Cleaning done · Mark available"}
          </Button>
        ) : session.orderId ? (
          <Button asChild size="lg" className="w-full">
            <Link href={`/admin/orders/active?tableId=${table.id}&orderId=${session.orderId}`}>Open order</Link>
          </Button>
        ) : (
          <Alert variant="warning">
            <AlertDescription>This seating is held. The order has not been placed yet.</AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  );
}

function RequestCard({
  request,
  pending,
  onUpdate,
}: {
  request: FloorServiceRequest;
  pending: boolean;
  onUpdate: (status: "acknowledged" | "completed") => void;
}) {
  const RequestIcon = request.type === "water" ? WaterIcon : request.type === "bill" ? ReceiptIcon : HelpIcon;
  return (
    <Card className="flex flex-wrap items-center gap-3 border-amber-200 p-3">
      <span className="rounded-xl bg-amber-50 p-2 text-amber-800"><RequestIcon className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <strong className="block text-sm capitalize">{request.type === "help" ? "Waiter help" : request.type}</strong>
        <span className="block text-xs text-text-muted">
          {request.customer?.name ? `${request.customer.name} · ` : ""}
          {request.seats.map((seat) => `${seat.tableName}/C${seat.chairNumber}`).join(" · ")}
        </span>
        <span className="mt-1 block text-xs font-medium text-amber-900">
          {request.assignedWaiter?.name ? `Assigned to ${request.assignedWaiter.name}` : "Needs waiter assignment"}
        </span>
      </div>
      <Button
        type="button"
        disabled={pending}
        onClick={() => onUpdate(request.status === "pending" ? "acknowledged" : "completed")}
        className={request.status === "pending" ? "bg-amber-400 text-amber-950 hover:bg-amber-400/90" : "bg-success text-white hover:bg-success/90"}
      >
        {request.status === "pending" ? "I’m going" : "Done"}
      </Button>
    </Card>
  );
}

export function UnifiedSeatingFloor({
  areaId,
  canManage,
  canBook,
  search,
  catalogTables,
  onEditTable,
  onDeleteTable,
  onSetTableAvailable,
  tableStatusPending,
}: {
  areaId: string | null;
  canManage: boolean;
  canBook: boolean;
  search: string;
  catalogTables: RestaurantTable[];
  onEditTable: (table: RestaurantTable) => void;
  onDeleteTable: (table: RestaurantTable) => void;
  onSetTableAvailable: (table: RestaurantTable) => void;
  tableStatusPending: boolean;
}) {
  const cache = useQueryClient();
  const router = useRouter();
  const floor = useQuery({
    queryKey: ["dining-floor"],
    queryFn: seatingAdminApi.get,
    refetchInterval: 5000,
  });
  const requests = useQuery({
    queryKey: ["service-requests"],
    queryFn: seatingAdminApi.requests,
    refetchInterval: 5000,
  });
  const [selected, setSelected] = useState<SeatSelection[]>([]);
  const [bookingMode, setBookingMode] = useState<BookingMode>("chairs");
  const [partySize, setPartySize] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [qrTable, setQrTable] = useState<FloorTable | null>(null);
  const [releaseGroup, setReleaseGroup] = useState<FloorSession | null>(null);
  const [focused, setFocused] = useState<{ session: FloorSession; table: FloorTable; chairNumber?: number } | null>(null);
  const [legacyCleaningTable, setLegacyCleaningTable] = useState<FloorTable | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function refresh() {
    cache.invalidateQueries({ queryKey: ["dining-floor"] });
    cache.invalidateQueries({ queryKey: ["tables"] });
    cache.invalidateQueries({ queryKey: ["service-requests"] });
  }

  const hold = useMutation({
    mutationFn: () => seatingAdminApi.hold(
      partySize,
      selected,
      { name: guestName.trim(), phone: guestPhone.trim() },
      bookingMode,
    ),
    onSuccess: () => {
      setSelected([]);
      setBookingMode("chairs");
      setGuestName("");
      setGuestPhone("");
      refresh();
    },
  });
  const updateRequest = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "acknowledged" | "completed" }) =>
      seatingAdminApi.updateRequest(id, status),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["service-requests"] }),
  });
  const release = useMutation({
    mutationFn: (reason: string) => seatingAdminApi.release(releaseGroup!.id, reason),
    onSuccess: () => { setReleaseGroup(null); refresh(); },
  });
  const markAvailable = useMutation({
    mutationFn: (sessionId: string) => seatingAdminApi.markAvailable(sessionId),
    onSuccess: () => { setFocused(null); refresh(); },
  });
  const openOrder = useMutation({
    mutationFn: seatingAdminApi.order,
    onSuccess: ({ order }) => router.push(`/admin/orders/active?tableId=${order.tableId}&orderId=${order.id}`),
  });

  const tables = useMemo(() => floor.data?.tables ?? [], [floor.data?.tables]);
  const sessions = (floor.data?.sessions ?? []).filter((session) =>
    ["held", "occupied", "cleaning"].includes(session.status),
  );
  const visible = tables.filter((table) =>
    (!areaId || table.areaId === areaId) && table.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const catalogById = useMemo(
    () => new Map(catalogTables.map((table) => [table.id, table])),
    [catalogTables],
  );
  const staleSelection = selected.some((seat) =>
    tables.find((table) => table.id === seat.tableId)?.chairs.find((chair) => chair.number === seat.chairNumber)?.status !== "available",
  );
  const phoneValid = /^(?:[6-9]\d{9}|\+[1-9]\d{7,14})$/.test(guestPhone.replace(/[\s()-]/g, ""));

  const statusCounts = useMemo(() => {
    const counts: Record<FloorChairStatus, number> = { available: 0, held: 0, occupied: 0, cleaning: 0, unavailable: 0 };
    for (const table of tables) for (const chair of table.chairs) counts[chair.status] += 1;
    return counts;
  }, [tables]);

  const attentionByTable = new Map<string, number[]>();
  for (const request of requests.data ?? []) {
    for (const seat of request.seats) {
      attentionByTable.set(seat.tableId, [...new Set([...(attentionByTable.get(seat.tableId) ?? []), seat.chairNumber])]);
    }
  }

  useSocketEvent("service:updated", refresh);
  useSocketEvent("dining:changed", refresh);

  function toggleChair(table: FloorTable, chairNumber: number, session?: FloorSession) {
    const chair = table.chairs.find((candidate) => candidate.number === chairNumber);
    if (!chair) return;
    if (chair.status === "available") {
      setBookingMode("chairs");
      setSelected((current) =>
        current.some((seat) => seat.tableId === table.id && seat.chairNumber === chairNumber)
          ? current.filter((seat) => !(seat.tableId === table.id && seat.chairNumber === chairNumber))
          : [...current, { tableId: table.id, chairNumber }],
      );
      return;
    }
    if (session) setFocused({ session, table, chairNumber });
  }

  function selectTable(table: FloorTable, session?: FloorSession) {
    if (table.wholeTableCleaning || (table.status === "needs_cleaning" && table.bookingMode === null)) {
      if (session) setFocused({ session, table });
      else setLegacyCleaningTable(table);
      return;
    }
    if (table.wholeTableOccupied || (table.status === "occupied" && table.bookingMode === null)) {
      if (session) setFocused({ session, table });
      else router.push(`/admin/orders/active?tableId=${table.id}`);
      return;
    }
    if (!table.chairs.every((chair) => chair.status === "available")) return;
    setBookingMode("whole_table");
    setSelected(table.chairs.map((chair) => ({ tableId: table.id, chairNumber: chair.number })));
    setPartySize((current) => Math.min(Math.max(current, 1), table.chairs.length));
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Live floor</h2>
          <p className="mt-1 text-sm text-text-muted">Tap the table for a whole-table action. Tap a chair to manage only that seat.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Live chair totals">
          {(Object.keys(STATUS_META) as FloorChairStatus[]).map((status) =>
            statusCounts[status] > 0 && (
              <Badge key={status} variant="outline" className="h-8 gap-2 px-3">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden="true" />
                {STATUS_META[status].label} <span className="text-text-muted">{statusCounts[status]}</span>
              </Badge>
            ),
          )}
        </div>
      </div>

      {requests.isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load guest service requests.</AlertDescription>
        </Alert>
      )}
      {(requests.data?.length ?? 0) > 0 && (
        <section aria-label="Guest service requests" className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h3 className="font-heading font-semibold text-amber-950">Guest requests</h3><p className="text-xs text-amber-900/70">Water, bill and waiter calls from occupied seats</p></div>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">{requests.data?.length} open</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {requests.data?.map((request) => (
              <RequestCard key={request.id} request={request} pending={updateRequest.isPending} onUpdate={(status) => updateRequest.mutate({ id: request.id, status })} />
            ))}
          </div>
        </section>
      )}

      {floor.isLoading && (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => <Skeleton key={key} className="h-96 rounded-3xl" />)}
        </div>
      )}
      {floor.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{floor.error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => floor.refetch()}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}
      {!floor.isLoading && !floor.isError && visible.length === 0 && (
        <Card className="p-8 text-center text-sm text-text-muted">No tables match this area or search.</Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((table) => {
          const tableSessions = sessions.filter((session) => session.seats.some((seat) => seat.tableId === table.id));
          const assignedWaiter = table.assignedWaiter ?? tableSessions.find((session) => session.assignedWaiter)?.assignedWaiter;
          const catalogTable = catalogById.get(table.id);
          return (
            <Card key={table.id} className={`rounded-3xl p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${table.wholeTableOccupied ? "border-red-200" : table.wholeTableCleaning ? "border-sky-200" : ""}`}>
              <header className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{table.areaName}</p>
                  <p className="mt-1 text-sm font-semibold text-text">{table.chairs.length} chairs</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 text-xs font-semibold">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQrTable(table)} className="text-primary hover:bg-orange-50 hover:text-primary">QR codes</Button>
                  {canManage && catalogTable && (
                    <>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onEditTable(catalogTable)} className="hover:bg-gray-50 hover:text-secondary">Edit</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onDeleteTable(catalogTable)} className="hover:bg-red-50 hover:text-error">Delete</Button>
                    </>
                  )}
                </div>
              </header>

              <UnifiedTableMap
                table={table}
                sessions={tableSessions}
                selected={selected.filter((seat) => seat.tableId === table.id).map((seat) => seat.chairNumber)}
                attention={attentionByTable.get(table.id) ?? []}
                selectionPending={hold.isPending}
                onChair={(chairNumber, session) => toggleChair(table, chairNumber, session)}
                onTable={(session) => selectTable(table, session)}
              />

              <footer className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                <div className="min-w-0">
                  <span className="block text-text-muted">Assigned waiter</span>
                  <strong className="block truncate text-text">{assignedWaiter?.name ?? (tableSessions.length ? "Awaiting assignment" : "—")}</strong>
                </div>
                {tableSessions.some((session) => session.orderId) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const session = tableSessions.find((candidate) => candidate.orderId);
                      if (session) router.push(`/admin/orders/active?tableId=${table.id}&orderId=${session.orderId}`);
                    }}
                    className="text-primary hover:text-primary"
                  >
                    Open order
                  </Button>
                )}
              </footer>
            </Card>
          );
        })}
      </div>

      {canBook && selected.length > 0 && (
        <Card className="sticky bottom-3 z-20 rounded-3xl border-orange-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:p-5" aria-label="Book selected seating">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="border-orange-100 bg-orange-50 text-primary">
                {bookingMode === "whole_table" ? "Whole table" : `${selected.length} chair${selected.length === 1 ? "" : "s"}`}
              </Badge>
              <p className="mt-2 text-xs text-text-muted">
                {selected.map((seat) => `${tables.find((table) => table.id === seat.tableId)?.name}/C${seat.chairNumber}`).join(" · ")}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSelected([]); setBookingMode("chairs"); }}>Clear selection</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="booking-guest-name" className="mb-1">Guest name</Label>
              <Input id="booking-guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} minLength={2} maxLength={100} placeholder="Booking name" />
            </div>
            <div>
              <Label htmlFor="booking-guest-phone" className="mb-1">Mobile number</Label>
              <Input id="booking-guest-phone" type="tel" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder="98765 43210" />
            </div>
            <div>
              <Label htmlFor="booking-party-size" className="mb-1">Party size</Label>
              <Input id="booking-party-size" type="number" min="1" max={selected.length} required value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">Staff bookings stay occupied until payment or a staff release.</p>
            <Button
              type="button"
              size="lg"
              onClick={() => hold.mutate()}
              disabled={hold.isPending || selected.length < partySize || staleSelection || partySize < 1 || guestName.trim().length < 2 || !phoneValid}
            >
              {hold.isPending ? "Booking…" : bookingMode === "whole_table" ? "Book whole table" : "Book selected chairs"}
            </Button>
          </div>
          {staleSelection && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>A selected chair is no longer available. Clear the selection and choose again.</AlertDescription>
            </Alert>
          )}
          {hold.isError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{hold.error.message}</AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h3 className="font-heading font-semibold">Active visits</h3><span className="text-sm text-text-muted">{sessions.length}</span></div>
        {sessions.length === 0 && !floor.isLoading && <Card className="p-5 text-sm text-text-muted">No active guest visits.</Card>}
        <div className="grid gap-3 lg:grid-cols-2">
          {sessions.map((session) => {
            const remaining = session.expiresAt ? Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now) / 1000)) : null;
            const firstTable = tables.find((table) => table.id === session.seats[0]?.tableId);
            return (
              <Card key={session.id} className={`flex flex-wrap items-center gap-3 p-4 ${session.status === "cleaning" ? "border-sky-200" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{session.customer?.name ?? `${session.partySize} guests`}</p>
                  <p className="mt-1 text-xs text-text-muted">{session.bookingMode === "whole_table" ? "Whole table" : `${session.seats.length} chairs`} · {session.source === "staff" ? "Staff booking" : "QR booking"}</p>
                  <p className="mt-1 truncate text-xs text-text-muted">{session.seats.map((seat) => `${tables.find((table) => table.id === seat.tableId)?.name ?? "Table"}/C${seat.chairNumber}`).join(" · ")}</p>
                  <p className="mt-1 text-xs font-medium text-text">Waiter: {session.assignedWaiter?.name ?? "Not assigned"}</p>
                </div>
                <Badge variant={session.status === "cleaning" ? "info" : remaining === null ? "error" : "warning"} className="tabular-nums">
                  {session.status === "cleaning" ? "Cleaning" : remaining === null ? "Occupied" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} hold`}
                </Badge>
                {session.status === "cleaning" && firstTable ? (
                  <Button type="button" size="sm" onClick={() => setFocused({ session, table: firstTable })} className="bg-success text-white hover:bg-success/90">Mark available</Button>
                ) : (
                  <>
                    {session.orderId && (
                      <Button asChild variant="outline" size="sm" className="text-primary hover:text-primary">
                        <Link href={`/admin/orders/active?tableId=${session.seats[0]?.tableId}&orderId=${session.orderId}`}>View order</Link>
                      </Button>
                    )}
                    {canBook && !session.orderId && session.source === "staff" && (
                      <Button type="button" size="sm" disabled={openOrder.isPending} onClick={() => openOrder.mutate(session.id)}>Take order</Button>
                    )}
                    {canBook && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { release.reset(); setReleaseGroup(session); }} className="hover:bg-red-50 hover:text-error">
                        Release
                      </Button>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {openOrder.isError && (
        <Alert variant="destructive">
          <AlertDescription>{openOrder.error.message}</AlertDescription>
        </Alert>
      )}
      {qrTable && <QrSheet table={qrTable} onClose={() => setQrTable(null)} />}
      {releaseGroup && <ReleaseGroup session={releaseGroup} onClose={() => setReleaseGroup(null)} onRelease={(reason) => release.mutate(reason)} pending={release.isPending} error={release.isError ? release.error.message : undefined} />}
      {focused && <SeatingDetails session={focused.session} table={focused.table} chairNumber={focused.chairNumber} onClose={() => { setFocused(null); markAvailable.reset(); }} onMarkAvailable={() => markAvailable.mutate(focused.session.id)} pending={markAvailable.isPending} error={markAvailable.isError ? markAvailable.error.message : undefined} />}
      {legacyCleaningTable && (
        <Modal title="Cleaning check" onClose={() => setLegacyCleaningTable(null)}>
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{legacyCleaningTable.name} is waiting for cleaning. Confirm only after the full table is ready for the next guests.</p>
            <Button
              type="button"
              size="lg"
              disabled={tableStatusPending}
              onClick={() => { const table = catalogById.get(legacyCleaningTable.id); if (table) onSetTableAvailable(table); setLegacyCleaningTable(null); }}
              className="w-full bg-success text-white hover:bg-success/90"
            >
              Cleaning done · Mark available
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
