"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { reservationsApi } from "@/lib/reservations/api";
import type { Reservation } from "@/lib/reservations/types";
import { areasApi, tablesApi } from "@/lib/tables/api";
import type { RestaurantTable, TableStatusChangedEvent } from "@/lib/tables/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { todayLocalDateString } from "@/lib/reservations/date";
import { PageHeader } from "@/components/ui/page-header";
import { PlusIcon } from "@/components/icons";
import { DateNavigator } from "./date-navigator";
import { StatusFilterPills, type StatusFilter } from "./status-filter-pills";
import { ReservationCard } from "./reservation-card";
import { ReservationFormModal, type ReservationFormValues } from "./reservation-form-modal";
import { SeatReservationModal } from "./seat-reservation-modal";

// PRD §2's combined "Tables/Reservation" RBAC column: Owner/Manager Full,
// Cashier View, Server Create/Edit — Chef and Inventory Manager get no nav
// entry at all (see sidebar.tsx) and this screen also self-gates in case
// the URL is hit directly, same pattern every other module screen follows.
const VIEW_ROLES = new Set(["owner", "manager", "cashier", "server"]);
const MANAGE_ROLES = new Set(["owner", "manager", "server"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function ReservationsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);

  const [date, setDate] = useState(todayLocalDateString());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formModal, setFormModal] = useState<
    { mode: "add" | "edit"; reservation: Reservation | null } | null
  >(null);
  const [seatModalReservation, setSeatModalReservation] = useState<Reservation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);

  // Fetched once per date (status filtering happens client-side below, same
  // convention `tables-screen.tsx` uses for its area-tab filter) so the
  // summary line always reflects every booking that day, independent of
  // which status pill is active.
  const reservationsQuery = useQuery({
    queryKey: ["reservations", date],
    queryFn: () => reservationsApi.list({ date }),
    enabled: canView,
  });

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: () => tablesApi.list(),
    enabled: canView,
  });

  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: () => areasApi.list(),
    enabled: canView,
  });

  // Reservations directly drive a table's hold state (assign/seat/cancel/
  // no-show — see the module doc note in `01-product-brief.md`), so the
  // table picker/dropdown this screen feeds (`SeatReservationModal`,
  // `ReservationFormModal`) needs to reflect a table going
  // reserved/occupied/free the instant it changes anywhere else, not just
  // after this screen's own mutations settle.
  useSocketEvent<TableStatusChangedEvent>(
    "table:status-changed",
    (event) => {
      queryClient.setQueryData<{ tables: RestaurantTable[] } | undefined>(
        ["tables"],
        (current) => {
          if (!current) return current;
          return {
            tables: current.tables.map((table) =>
              table.id === event.table.id ? event.table : table,
            ),
          };
        },
      );
    },
    { enabled: canView },
  );

  const reservations = useMemo(
    () => reservationsQuery.data?.reservations ?? [],
    [reservationsQuery.data],
  );
  const tables = useMemo(() => tablesQuery.data?.tables ?? [], [tablesQuery.data]);
  const areas = useMemo(() => areasQuery.data?.areas ?? [], [areasQuery.data]);

  const tableLabelById = useMemo(() => {
    const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
    return new Map(
      tables.map((table) => [table.id, `${table.name} · ${areaNameById.get(table.areaId) ?? ""}`]),
    );
  }, [tables, areas]);

  const visibleReservations = useMemo(() => {
    if (statusFilter === "all") return reservations;
    return reservations.filter((reservation) => reservation.status === statusFilter);
  }, [reservations, statusFilter]);

  const summary = useMemo(() => {
    const bookings = reservations.length;
    const covers = reservations.reduce((sum, reservation) => sum + reservation.partySize, 0);
    return { bookings, covers };
  }, [reservations]);

  const invalidateReservations = () =>
    queryClient.invalidateQueries({ queryKey: ["reservations", date] });

  const createMutation = useMutation({
    mutationFn: (input: ReservationFormValues) =>
      reservationsApi.create({
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        partySize: input.partySize,
        reservationTime: input.reservationTime,
        tableId: input.tableId,
        notes: input.notes,
      }),
    onSuccess: () => {
      invalidateReservations();
      setFormModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not create the reservation.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof reservationsApi.update>[1] }) =>
      reservationsApi.update(id, input),
    onSuccess: () => {
      invalidateReservations();
      setFormModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the reservation.")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "no_show" }) =>
      reservationsApi.update(id, { status }),
    onSuccess: () => invalidateReservations(),
    onError: (error) => window.alert(errorMessageOf(error, "Could not update this reservation.")),
  });

  const seatMutation = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) =>
      reservationsApi.seat(id, { tableId }),
    onSuccess: () => {
      invalidateReservations();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setSeatModalReservation(null);
      setSeatError(null);
    },
    onError: (error) => setSeatError(errorMessageOf(error, "Could not seat this reservation.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.remove(id),
    onSuccess: () => invalidateReservations(),
    onError: (error) => window.alert(errorMessageOf(error, "Could not delete this reservation.")),
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to Reservations.</p>
      </main>
    );
  }

  const isLoading = reservationsQuery.isLoading || tablesQuery.isLoading || areasQuery.isLoading;
  const isError = reservationsQuery.isError || tablesQuery.isError || areasQuery.isError;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Reservations"
        subtitle="Bookings for the day, with table holds handled automatically."
        action={
          canManage && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setFormModal({ mode: "add", reservation: null });
              }}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
            >
              <PlusIcon className="h-4 w-4" />
              New Reservation
            </button>
          )
        }
      />

      <DateNavigator
        date={date}
        onChange={setDate}
        summary={
          !isLoading &&
          !isError && (
            <p className="text-small text-text-muted">
              {summary.bookings} booking{summary.bookings === 1 ? "" : "s"} · {summary.covers} cover
              {summary.covers === 1 ? "" : "s"}
            </p>
          )
        }
      />

      <StatusFilterPills value={statusFilter} onChange={setStatusFilter} />

      {isLoading && <p className="text-small text-text-muted">Loading reservations…</p>}

      {isError && (
        <p className="text-small text-error">
          Could not load reservations — check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && visibleReservations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            {reservations.length === 0
              ? "No reservations for this day yet."
              : "No reservations match this filter."}
          </p>
          {canManage && reservations.length === 0 && (
            <button
              type="button"
              onClick={() => setFormModal({ mode: "add", reservation: null })}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
            >
              New Reservation
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && visibleReservations.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              tableName={reservation.tableId ? tableLabelById.get(reservation.tableId) : undefined}
              canManage={canManage}
              onSeat={(target) => {
                setSeatError(null);
                setSeatModalReservation(target);
              }}
              onEdit={(target) => {
                setFormError(null);
                setFormModal({ mode: "edit", reservation: target });
              }}
              onCancel={(target) => {
                if (window.confirm(`Cancel the reservation for ${target.guestName}?`)) {
                  statusMutation.mutate({ id: target.id, status: "cancelled" });
                }
              }}
              onNoShow={(target) => {
                if (window.confirm(`Mark ${target.guestName} as a no-show?`)) {
                  statusMutation.mutate({ id: target.id, status: "no_show" });
                }
              }}
              onDelete={(target) => {
                if (window.confirm(`Delete the reservation for ${target.guestName}?`)) {
                  deleteMutation.mutate(target.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {formModal && (
        <ReservationFormModal
          reservation={formModal.reservation}
          defaultDate={date}
          tables={tables}
          areas={areas}
          onClose={() => {
            setFormModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (formModal.mode === "add") {
              createMutation.mutate(input);
            } else if (formModal.reservation) {
              updateMutation.mutate({
                id: formModal.reservation.id,
                input: {
                  guestName: input.guestName,
                  guestPhone: input.guestPhone,
                  partySize: input.partySize,
                  reservationTime: input.reservationTime,
                  tableId: input.tableId ?? null,
                  notes: input.notes,
                  status: input.status,
                },
              });
            }
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          errorMessage={formError}
        />
      )}

      {seatModalReservation && (
        <SeatReservationModal
          reservation={seatModalReservation}
          tables={tables}
          areas={areas}
          onClose={() => {
            setSeatModalReservation(null);
            setSeatError(null);
          }}
          onConfirm={(tableId) =>
            seatMutation.mutate({ id: seatModalReservation.id, tableId })
          }
          isSubmitting={seatMutation.isPending}
          errorMessage={seatError}
        />
      )}
    </main>
  );
}
