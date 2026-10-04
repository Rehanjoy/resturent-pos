import type { QueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";

const INVENTORY = ["inventory-items", "dashboard-inventory-items", "dish-costing", "production-plan"];
const CUSTOMERS = ["customers", "customer"];
const ANALYTICS = ["dashboard-summary", "dashboard-staff-performance"];
const BILLING = ["invoice-history", "invoice-detail", "invoice-by-order"];
const RECOVERY = [...INVENTORY, ...CUSTOMERS, ...ANALYTICS, ...BILLING,
  "order", "orders-overview", "kitchenTickets", "tables", "dining-floor", "service-requests"];

/** Batch one burst of related socket events into one refresh per query.
 * Mounted screens refetch; inactive screens are marked stale for next visit.
 * Order/KOT payloads remain handled immediately by their screen listeners. */
export function subscribeLiveUpdates(socket: Pick<Socket, "on" | "off">, cache: QueryClient) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (keys: string[]) => {
    keys.forEach((key) => pending.add(key));
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const keys = new Set(pending);
      pending.clear();
      void cache.invalidateQueries({ predicate: (query) => keys.has(String(query.queryKey[0])) });
    }, 100);
  };
  const onOrder = (event: { order?: { status?: string } }) => {
    schedule(ANALYTICS);
    if (event.order?.status === "closed" || event.order?.status === "void") {
      schedule([...CUSTOMERS, ...BILLING]);
    }
  };
  const onInventory = () => schedule(INVENTORY);
  const onDining = () => schedule([...CUSTOMERS, ...ANALYTICS]);
  const onConnect = () => schedule(RECOVERY);
  socket.on("order:created", onOrder);
  socket.on("order:updated", onOrder);
  socket.on("kitchen:new-ticket", onInventory);
  socket.on("inventory:changed", onInventory);
  socket.on("dining:changed", onDining);
  socket.on("connect", onConnect);
  return () => {
    if (timer) clearTimeout(timer);
    pending.clear();
    socket.off("order:created", onOrder);
    socket.off("order:updated", onOrder);
    socket.off("kitchen:new-ticket", onInventory);
    socket.off("inventory:changed", onInventory);
    socket.off("dining:changed", onDining);
    socket.off("connect", onConnect);
  };
}
