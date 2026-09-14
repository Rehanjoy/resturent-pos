"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { areasApi, tablesApi } from "@/lib/tables/api";
import type {
  Area,
  RestaurantTable,
  TableStatus,
  TableStatusChangedEvent,
} from "@/lib/tables/types";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaTabs } from "./area-tabs";
import { AreaFormModal } from "./area-form-modal";
import { TableFormModal } from "./table-form-modal";
import { UnifiedSeatingFloor } from "./unified-seating-floor";

const VIEW_ROLES = new Set(["owner", "manager", "cashier", "server"]);
const MANAGE_ROLES = new Set(["owner", "manager"]);
const STATUS_CHANGE_ROLES = new Set(["owner", "manager", "server"]);
function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function TablesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);
  const canChangeStatus = !!user && STATUS_CHANGE_ROLES.has(user.role);

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [search, setSearch] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "");
  const [areaModal, setAreaModal] = useState<{ mode: "add" | "edit"; area: Area | null } | null>(
    null,
  );
  const [tableModal, setTableModal] = useState<
    { mode: "add" | "edit"; table: RestaurantTable | null } | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const areasQuery = useQuery({
    queryKey: ["areas"],
    queryFn: () => areasApi.list(),
    enabled: canView,
  });

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: () => tablesApi.list(),
    enabled: canView,
  });

  const areas = areasQuery.data?.areas ?? [];
  const tables = tablesQuery.data?.tables;
  const visibleTables = useMemo(() => {
    const all = tables ?? [];
    return all.filter(table => (!activeAreaId || table.areaId === activeAreaId) && table.name.toLowerCase().includes(search.toLowerCase()));
  }, [tables, activeAreaId, search]);

  // Real-time table-status sync (PRD §3.5) — every connected terminal
  // patches its local cache in place when any terminal changes a table's
  // status, no refetch needed. Also listens for `order:updated` so the
  // item-count/amount shown on an occupied table's card stays live too
  // (e.g. another terminal adds an item to the same table's order) —
  // additive to the pre-existing table-status subscription, not a
  // replacement for it.
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

  const createAreaMutation = useMutation({
    mutationFn: areasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setAreaModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the area.")),
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; displayOrder?: number } }) =>
      areasApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setAreaModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the area.")),
  });

  const deleteAreaMutation = useMutation({
    mutationFn: areasApi.remove,
    onSuccess: (_, areaId) => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      if (activeAreaId === areaId) setActiveAreaId(null);
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the area."));
    },
  });

  const createTableMutation = useMutation({
    mutationFn: tablesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setTableModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the table.")),
  });

  const updateTableMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{
        areaId: string;
        name: string;
        seatingCapacity: number;
        shape: RestaurantTable["shape"];
      }>;
    }) => tablesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setTableModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the table.")),
  });

  const deleteTableMutation = useMutation({
    mutationFn: tablesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the table."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      tablesApi.updateStatus(id, status),
    onSuccess: (result) => {
      queryClient.setQueryData<{ tables: RestaurantTable[] } | undefined>(
        ["tables"],
        (current) => {
          if (!current) return current;
          return {
            tables: current.tables.map((table) =>
              table.id === result.table.id ? result.table : table,
            ),
          };
        },
      );
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not change the table's status."));
    },
  });

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-text-muted">
          You don&apos;t have access to Tables &amp; Areas.
        </p>
      </main>
    );
  }

  const isLoading = areasQuery.isLoading || tablesQuery.isLoading;
  const isError = areasQuery.isError || tablesQuery.isError;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Tables"
        subtitle="A place for every guest. Manage chairs, shared tables and group bookings."
        action={
          canManage && (
            <Button
              type="button"
              variant="accent"
              onClick={() => setTableModal({ mode: "add", table: null })}
              disabled={areas.length === 0}
              title={areas.length === 0 ? "Add an area first" : undefined}
            >
              + Add Table
            </Button>
          )
        }
      />

      <div className="rounded-2xl border border-border bg-white p-2 shadow-sm">
        <label htmlFor="table-search" className="sr-only">Search tables</label>
        <Input
          id="table-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by table name…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <AreaTabs
        areas={areas}
        activeAreaId={activeAreaId}
        onSelect={setActiveAreaId}
        canManage={canManage}
        onAddArea={() => {
          setFormError(null);
          setAreaModal({ mode: "add", area: null });
        }}
        onEditArea={(area) => {
          setFormError(null);
          setAreaModal({ mode: "edit", area });
        }}
        onDeleteArea={(area) => {
          if (window.confirm(`Delete area "${area.name}"?`)) {
            deleteAreaMutation.mutate(area.id);
          }
        }}
      />

      {isLoading && (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => <Skeleton key={key} className="h-40 rounded-3xl" />)}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load tables — check your connection and try again.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && areas.length === 0 && (
        <Card className="border-dashed p-8 text-center">
          <p className="text-body text-text-muted">
            No areas yet. Add your first area to start setting up tables.
          </p>
          {canManage && (
            <Button type="button" variant="accent" onClick={() => setAreaModal({ mode: "add", area: null })} className="mt-4">
              Add Area
            </Button>
          )}
        </Card>
      )}

      {!isLoading && !isError && areas.length > 0 && visibleTables.length === 0 && (
        <Card className="border-dashed p-8 text-center">
          <p className="text-body text-text-muted">
            No tables yet. Add your first table to start taking orders.
          </p>
          {canManage && (
            <Button type="button" variant="accent" onClick={() => setTableModal({ mode: "add", table: null })} className="mt-4">
              Add Table
            </Button>
          )}
        </Card>
      )}

      {!isLoading && !isError && tables && tables.length > 0 && (
        <UnifiedSeatingFloor
          areaId={activeAreaId}
          search={search}
          canManage={canManage}
          canBook={canChangeStatus}
          catalogTables={tables}
          onEditTable={(target) => {
            setFormError(null);
            setTableModal({ mode: "edit", table: target });
          }}
          onDeleteTable={(target) => {
            if (window.confirm(`Delete table "${target.name}"?`)) {
              deleteTableMutation.mutate(target.id);
            }
          }}
          onSetTableAvailable={(target) =>
            statusMutation.mutate({ id: target.id, status: "free" })
          }
          tableStatusPending={statusMutation.isPending}
        />
      )}

      {areaModal && (
        <AreaFormModal
          area={areaModal.area}
          onClose={() => {
            setAreaModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (areaModal.mode === "add") {
              createAreaMutation.mutate(input);
            } else if (areaModal.area) {
              updateAreaMutation.mutate({ id: areaModal.area.id, input });
            }
          }}
          isSubmitting={createAreaMutation.isPending || updateAreaMutation.isPending}
          errorMessage={formError}
        />
      )}

      {tableModal && (
        <TableFormModal
          table={tableModal.table}
          areas={areas}
          defaultAreaId={activeAreaId}
          onClose={() => {
            setTableModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (tableModal.mode === "add") {
              createTableMutation.mutate(input);
            } else if (tableModal.table) {
              updateTableMutation.mutate({ id: tableModal.table.id, input });
            }
          }}
          isSubmitting={createTableMutation.isPending || updateTableMutation.isPending}
          errorMessage={formError}
        />
      )}
    </main>
  );
}
