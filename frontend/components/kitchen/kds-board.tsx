"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { tablesApi } from "@/lib/tables/api";
import { kitchenApi } from "@/lib/kitchen/api";
import type { Kot, KitchenNewTicketEvent, KitchenTicketReadyEvent } from "@/lib/orders/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { PageHeader } from "@/components/ui/page-header";
import { TicketCard } from "./ticket-card";

const VIEW_ROLES = new Set(["owner", "manager", "chef", "cashier", "server"]);
const MANAGE_ROLES = new Set(["owner", "manager", "chef"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Kitchen Display System board (PRD §3.4). Real-time by design: an initial
 * fetch on mount, then every update arrives over Socket.io
 * (`kitchen:new-ticket`, `kitchen:ticket-ready`, `order:updated`) — no
 * polling loop, matching the PRD's "<1s KDS latency" requirement.
 */
export function KdsBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);

  const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: () => tablesApi.list(), enabled: canView });
  const ticketsQuery = useQuery({
    queryKey: ["kitchenTickets"],
    queryFn: () => kitchenApi.listTickets().then((result) => result.tickets),
    enabled: canView,
  });

  const tableNameById = new Map(
    (tablesQuery.data?.tables ?? []).map((table) => [table.id, table.name]),
  );

  const upsertTicket = (kot: Kot) => {
    queryClient.setQueryData<Kot[] | undefined>(["kitchenTickets"], (current) => {
      if (!current) return [kot];
      const exists = current.some((candidate) => candidate.id === kot.id);
      const next = exists
        ? current.map((candidate) => (candidate.id === kot.id ? kot : candidate))
        : [...current, kot];
      return [...next].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    });
  };

  useSocketEvent<KitchenNewTicketEvent>(
    "kitchen:new-ticket",
    (event) => upsertTicket(event.kot),
    { enabled: canView },
  );
  useSocketEvent<KitchenTicketReadyEvent>(
    "kitchen:ticket-ready",
    (event) => upsertTicket(event.kot),
    { enabled: canView },
  );
  // Serving an item doesn't carry a KOT payload (it's an order-level
  // action) — refetch so tickets that just became fully-served drop off
  // the active queue immediately (PRD §3.4 "auto-clears ticket ...").
  useSocketEvent(
    "order:updated",
    () => queryClient.invalidateQueries({ queryKey: ["kitchenTickets"] }),
    { enabled: canView },
  );

  const itemReadyMutation = useMutation({
    mutationFn: ({ kotId, orderItemId }: { kotId: string; orderItemId: string }) =>
      kitchenApi.markItemReady(kotId, orderItemId),
    onSuccess: (result) => {
      queryClient.setQueryData<Kot[] | undefined>(["kitchenTickets"], (current) =>
        current?.map((kot) => (kot.id === result.kot.id ? result.kot : kot)) ?? current,
      );
    },
    onError: (error) => window.alert(errorMessageOf(error, "Could not mark this item ready.")),
  });

  const allReadyMutation = useMutation({
    mutationFn: (kotId: string) => kitchenApi.markAllReady(kotId),
    onSuccess: (result) => {
      queryClient.setQueryData<Kot[] | undefined>(["kitchenTickets"], (current) =>
        current?.map((kot) => (kot.id === result.kot.id ? result.kot : kot)) ?? current,
      );
    },
    onError: (error) => window.alert(errorMessageOf(error, "Could not mark this ticket ready.")),
  });

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-text-muted">You don&apos;t have access to the Kitchen Display.</p>
      </main>
    );
  }

  const tickets = ticketsQuery.data ?? [];
  const cookingTickets = tickets.filter((kot) => !kot.allReadyAt);
  const readyTickets = tickets.filter((kot) => !!kot.allReadyAt);

  const isLoading = ticketsQuery.isLoading || tablesQuery.isLoading;
  const isError = ticketsQuery.isError || tablesQuery.isError;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Kitchen Display"
        subtitle={
          isLoading
            ? "Loading tickets…"
            : `${cookingTickets.length} in kitchen · ${readyTickets.length} ready to serve`
        }
      />

      {isLoading && <p className="text-small text-text-muted">Loading tickets…</p>}

      {isError && (
        <p className="text-small text-error">
          Could not load kitchen tickets — check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && tickets.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            No active tickets — sent orders will appear here the moment they hit the kitchen.
          </p>
        </div>
      )}

      {!isLoading && !isError && tickets.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-h3 font-semibold text-text">
              In Kitchen ({cookingTickets.length})
            </h2>
            <div className="flex flex-col gap-4">
              {cookingTickets.length === 0 && (
                <p className="text-small text-text-muted">Nothing cooking right now.</p>
              )}
              {cookingTickets.map((kot) => (
                <TicketCard
                  key={kot.id}
                  kot={kot}
                  tableName={tableNameById.get(kot.tableId) ?? "Table"}
                  canManage={canManage}
                  isMarkingItem={
                    itemReadyMutation.isPending && itemReadyMutation.variables?.kotId === kot.id
                  }
                  isMarkingAll={allReadyMutation.isPending && allReadyMutation.variables === kot.id}
                  onMarkItemReady={(orderItemId) =>
                    itemReadyMutation.mutate({ kotId: kot.id, orderItemId })
                  }
                  onMarkAllReady={() => allReadyMutation.mutate(kot.id)}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-h3 font-semibold text-text">
              Ready to Serve ({readyTickets.length})
            </h2>
            <div className="flex flex-col gap-4">
              {readyTickets.length === 0 && (
                <p className="text-small text-text-muted">No tickets waiting to be served.</p>
              )}
              {readyTickets.map((kot) => (
                <TicketCard
                  key={kot.id}
                  kot={kot}
                  tableName={tableNameById.get(kot.tableId) ?? "Table"}
                  canManage={canManage}
                  isMarkingItem={false}
                  isMarkingAll={false}
                  onMarkItemReady={() => {}}
                  onMarkAllReady={() => {}}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
