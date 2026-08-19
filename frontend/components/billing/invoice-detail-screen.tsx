"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { billingApi } from "@/lib/billing/api";
import type { Invoice, Payment, InvoiceStatus } from "@/lib/billing/types";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);

const MODE_LABEL: Record<Payment["mode"], string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
};

const STATUS_STYLE: Record<InvoiceStatus, { label: string; bg: string; text: string; border: string }> = {
  issued: {
    label: "Issued",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
  },
  void: {
    label: "Void",
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
  },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Full invoice detail screen — shows all info about a bill: items with qty
 * & price, table name, order timing, payment breakdown, status. Accessible
 * from the Bill History list.
 */
export function InvoiceDetailScreen({ invoiceId }: { invoiceId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);

  const canView = !!user && BILLING_ROLES.has(user.role);

  const detailQuery = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => billingApi.getInvoice(invoiceId),
    enabled: canView,
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to billing.</p>
      </main>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <PageHeader title="Bill Detail" subtitle="Loading..." />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </main>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <PageHeader title="Bill Detail" />
        <p className="text-small text-error">
          Could not load this invoice — check your connection and try again.
        </p>
      </main>
    );
  }

  const { invoice, payments, tableName, orderCreatedAt } = detailQuery.data as {
    invoice: Invoice;
    payments: Payment[];
    tableName?: string;
    orderCreatedAt?: string;
    orderStatus?: string;
  };

  const status = STATUS_STYLE[invoice.status];

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      const blob = await billingApi.fetchInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Could not download PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <PageHeader
        title={`Bill #${invoice.invoiceNumber}`}
        subtitle={formatDateTime(invoice.createdAt)}
        action={
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-button font-bold text-white shadow-md shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/40 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <svg className="h-4 w-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="relative z-10">{isDownloading ? "Preparing…" : "Download PDF"}</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/invoices")}
              className="rounded-xl border border-border/80 bg-surface px-5 py-2.5 text-small font-semibold text-text-muted transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              ← Back to Bills
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {/* ─── Left: Items + Totals ──────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="overflow-hidden rounded-[20px] border border-border/60 bg-surface/80 shadow-md backdrop-blur-xl">
            <div className="border-b border-border/40 bg-background/50 px-6 py-4">
              <h2 className="font-heading text-[1.1rem] font-bold text-text">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/30 bg-surface/50">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">#</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">Item</th>
                    <th className="px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-text-muted">Qty</th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Rate</th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.menuItemId + idx} className="group transition-colors hover:bg-primary/[0.03]">
                      <td className="px-6 py-4 text-small text-text-muted/70">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <p className="text-body font-semibold text-text group-hover:text-primary transition-colors">{item.nameSnapshot}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-background font-medium text-text shadow-sm border border-border/50">
                          {item.qty}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-small font-medium text-text-muted">
                        {formatMoney(item.priceSnapshot)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-heading text-body font-bold text-text">
                          {formatMoney(item.priceSnapshot * item.qty)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gradient-to-b from-transparent to-background/50 px-6 py-6 pb-8 border-t border-border/40">
              <div className="flex w-full justify-end">
                <div className="flex w-full max-w-sm flex-col gap-3">
                  <div className="flex justify-between text-body">
                    <span className="text-text-muted font-medium">Subtotal</span>
                    <span className="font-semibold text-text">{formatMoney(invoice.subtotal)}</span>
                  </div>
                  {invoice.discount && (
                    <div className="flex justify-between text-body text-success">
                      <span className="font-medium">
                        Discount{" "}
                        {invoice.discount.type === "percent" ? `(${invoice.discount.value}%)` : "(Flat)"}
                      </span>
                      <span className="font-bold">-{formatMoney(invoice.discount.amountApplied)}</span>
                    </div>
                  )}
                  {invoice.taxLines.map((tax) => (
                    <div key={tax.name} className="flex justify-between text-body text-text-muted">
                      <span className="font-medium">
                        {tax.name} ({tax.ratePercent}%)
                      </span>
                      <span className="font-semibold text-text">{formatMoney(tax.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-border/80">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-lg font-bold text-text">Grand Total</span>
                      <span className="rounded-xl bg-primary/10 px-4 py-2 font-heading text-xl font-bold text-primary shadow-sm ring-1 ring-primary/20">
                        {formatMoney(invoice.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right: Info Cards ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-surface to-background p-[1px] shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-border/50 to-transparent" />
            <div className="relative flex flex-col rounded-[19px] bg-surface h-full w-full overflow-hidden">
              <div className="border-b border-border/40 bg-background/50 px-6 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Timeline</h3>
              </div>
              <div className="flex flex-col gap-5 px-6 py-6">
                {tableName && (
                  <div className="group flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
                      <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Table</p>
                      <p className="text-body font-bold text-text">{tableName}</p>
                    </div>
                  </div>
                )}
                {orderCreatedAt && (
                  <div className="group flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 transition-transform group-hover:scale-110">
                      <svg className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Order Started</p>
                      <p className="text-body font-semibold text-text">{formatDateTime(orderCreatedAt)}</p>
                    </div>
                  </div>
                )}
                <div className="group flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 transition-transform group-hover:scale-110">
                    <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Bill Generated</p>
                    <p className="text-body font-semibold text-text">{formatDateTime(invoice.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-border/60 bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-border/40 bg-background/50 px-6 py-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Overview</h3>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${status.bg} ${status.text}`}>
                {status.label}
              </span>
            </div>
            <div className="px-6 py-6">
              {invoice.status === "void" && invoice.voidReason && (
                <div className="mb-6 rounded-xl border border-error/20 bg-error/5 p-4 text-small">
                  <p className="font-bold text-error mb-1">Marked as Void</p>
                  <p className="text-error/80">{invoice.voidReason}</p>
                </div>
              )}
              
              <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted line-clamp-1">
                Payment Breakdown
              </p>
              
              {payments.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <p className="text-small font-medium text-text-muted">Awaiting Payment</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-background">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shadow-sm ring-1 ring-primary/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                            {payment.mode === "upi" ? "UPI" : payment.mode.slice(0, 3)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-small font-bold text-text">{MODE_LABEL[payment.mode]}</span>
                          <span className="text-[10px] font-semibold uppercase text-text-muted">
                            {formatTime(payment.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span className="font-heading text-body font-bold text-text">
                        {formatMoney(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
