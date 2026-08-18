"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { ordersApi } from "@/lib/orders/api";
import type { OrderStatus } from "@/lib/orders/types";
import { billingApi } from "@/lib/billing/api";
import type { Invoice, Payment, PaymentMode } from "@/lib/billing/types";
import { BillItems } from "./bill-items";
import { DiscountPanel } from "./discount-panel";
import { TaxSummary } from "./tax-summary";
import { PaymentPanel } from "./payment-panel";
import { SettlementConfirmation } from "./settlement-confirmation";
import { VoidInvoiceModal } from "./void-invoice-modal";

const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);
const VOID_ROLES = new Set(["owner", "manager"]);

const BLOCKED_STATUS_MESSAGE: Partial<Record<OrderStatus, string>> = {
  draft: "This order isn't ready to bill yet — send it to the kitchen and serve it first.",
  sent: "This order isn't ready to bill yet — serve all items first.",
  in_kitchen: "This order isn't ready to bill yet — serve all items first.",
  ready: "This order isn't ready to bill yet — serve all items first.",
  closed: "This order has already been billed and paid.",
  void: "This order was voided and can't be billed.",
  // "billed" is handled separately below — it's a real gap, not a hard stop.
};

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Orchestrator for `/admin/billing/[orderId]` — the Settle Bill screen.
 * Mirrors `OrderWorkspace`'s shape (fetch order, gate by role, hand real
 * work to dumb child components) but the child components here are billing-
 * specific: `DiscountPanel` (with the manager-approval retry loop),
 * `TaxSummary` (renders exactly what the backend computed), `PaymentPanel`
 * (split payment across modes), `SettlementConfirmation`.
 *
 * Resumes mid-settlement after a reload: if the order is already `billed`
 * (invoice generated, not yet paid) and no invoice is held in local state
 * yet, `GET /api/invoices/by-order/:orderId` fetches it back so the
 * PaymentPanel picks up where the previous tab/session left off instead of
 * dead-ending.
 */
export function BillingWorkspace({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settledPayments, setSettledPayments] = useState<Payment[] | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidedNotice, setVoidedNotice] = useState<string | null>(null);

  const canBill = !!user && BILLING_ROLES.has(user.role);
  const canVoid = !!user && VOID_ROLES.has(user.role);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(orderId).then((result) => result.order),
  });

  const invoiceByOrderQuery = useQuery({
    queryKey: ["invoice-by-order", orderId],
    queryFn: () => billingApi.getInvoiceByOrder(orderId).then((result) => result.invoice),
    enabled: !invoice && orderQuery.data?.status === "billed",
  });

  const effectiveInvoice = invoice ?? invoiceByOrderQuery.data ?? null;

  const settleMutation = useMutation({
    mutationFn: (payments: { mode: PaymentMode; amount: number }[]) =>
      billingApi.settlePayment({ invoiceId: effectiveInvoice!.id, payments }),
    onSuccess: (result) => {
      setSettleError(null);
      setSettledPayments(result.payments);
    },
    onError: (error) => setSettleError(errorMessageOf(error, "Could not settle this bill.")),
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) => billingApi.voidInvoice(effectiveInvoice!.id, reason),
    onSuccess: (result) => {
      setVoidModalOpen(false);
      setVoidError(null);
      if (!settledPayments || settledPayments.length === 0) {
        // Not yet paid — backend reverted the order to "served". Reset
        // local state so DiscountPanel reappears for a corrected bill, and
        // drop the cached by-order lookup so a resumed-via-reload session
        // doesn't fall back to the now-voided invoice.
        setInvoice(null);
        setSettledPayments(null);
        queryClient.removeQueries({ queryKey: ["invoice-by-order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        setVoidedNotice("Bill voided. This order is back to Served — you can generate a new bill.");
      } else {
        // Already paid — order/table state intentionally untouched (see
        // backend `voidInvoice` design note). Just reflect the void.
        setInvoice(result.invoice);
        setVoidedNotice("Bill voided and logged for audit. Payment already collected was not reversed.");
      }
    },
    onError: (error) => setVoidError(errorMessageOf(error, "Could not void this bill.")),
  });

  if (!user) return null;

  if (!canBill) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to billing.</p>
      </main>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-small text-text-muted">Loading bill…</p>
      </main>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-small text-error">
          Could not load this order — check your connection and try again.
        </p>
      </main>
    );
  }

  const order = orderQuery.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-h1 font-semibold text-text">Settle Bill</h1>
        <button
          type="button"
          onClick={() => router.push(`/admin/orders/active?tableId=${order.tableId}`)}
          className="text-small text-secondary hover:underline"
        >
          Back to Order
        </button>
      </div>

      {voidedNotice && <p className="text-small text-text-muted">{voidedNotice}</p>}

      {settledPayments && effectiveInvoice ? (
        <SettlementConfirmation invoice={effectiveInvoice} payments={settledPayments} />
      ) : effectiveInvoice ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="font-heading text-h3 font-semibold text-text">
              Bill #{effectiveInvoice.invoiceNumber}
            </h2>
            <BillItems items={order.items} />
          </div>
          <aside className="flex w-full max-w-sm shrink-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <TaxSummary invoice={effectiveInvoice} />
            <PaymentPanel
              total={effectiveInvoice.total}
              onSettle={(payments) => {
                setSettleError(null);
                settleMutation.mutate(payments);
              }}
              isSettling={settleMutation.isPending}
              errorMessage={settleError}
            />
            {canVoid && (
              <button
                type="button"
                onClick={() => {
                  setVoidError(null);
                  setVoidModalOpen(true);
                }}
                className="rounded-md border border-error px-4 py-2 text-button text-error"
              >
                Void This Bill
              </button>
            )}
          </aside>
        </div>
      ) : order.status === "served" ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="font-heading text-h3 font-semibold text-text">Order Items</h2>
            <BillItems items={order.items} />
          </div>
          <aside className="w-full max-w-sm shrink-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <DiscountPanel orderId={orderId} subtotal={order.subtotal} onGenerated={setInvoice} />
          </aside>
        </div>
      ) : order.status === "billed" && invoiceByOrderQuery.isLoading ? (
        <p className="text-small text-text-muted">Loading bill…</p>
      ) : order.status === "billed" && invoiceByOrderQuery.isError ? (
        <p className="text-small text-error">
          Could not load this bill — check your connection and try again.
        </p>
      ) : (
        <p className="text-body text-text-muted">
          {BLOCKED_STATUS_MESSAGE[order.status] ?? "This order can't be billed right now."}
        </p>
      )}

      {voidModalOpen && effectiveInvoice && (
        <VoidInvoiceModal
          invoiceNumber={effectiveInvoice.invoiceNumber}
          onClose={() => setVoidModalOpen(false)}
          isSubmitting={voidMutation.isPending}
          errorMessage={voidError}
          onConfirm={(reason) => voidMutation.mutate(reason)}
        />
      )}
    </main>
  );
}
