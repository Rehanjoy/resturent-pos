"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { billingApi } from "@/lib/billing/api";
import type { Invoice, InvoiceStatus } from "@/lib/billing/types";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

const BILLING_ROLES = new Set(["owner", "manager", "cashier"]);

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  issued: {
    label: "Issued",
    className:
      "bg-success/10 text-success border border-success/20",
  },
  void: {
    label: "Void",
    className:
      "bg-error/10 text-error border border-error/20",
  },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Bill History Screen — lists all invoices for the restaurant, sorted by
 * creation time (newest first). Each row shows invoice number, time, total,
 * and status. Clicking a row navigates to the invoice detail page; the PDF
 * download button lets staff grab a copy inline.
 */
export function BillHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const canView = !!user && BILLING_ROLES.has(user.role);

  const queryResult = useQuery({
    queryKey: ["invoice-history", page, statusFilter],
    queryFn: () =>
      billingApi.listInvoices({
        page,
        limit: 20,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    enabled: canView,
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You do not have access to billing history.</p>
      </main>
    );
  }

  const { data, isLoading, isError } = queryResult;

  async function handleDownloadPdf(e: React.MouseEvent, inv: Invoice) {
    e.stopPropagation();
    setIsDownloading(inv.id);
    try {
      const blob = await billingApi.fetchInvoicePdf(inv.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${inv.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Could not download PDF. Please try again.");
    } finally {
      setIsDownloading(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Bill History"
        subtitle="All generated bills, newest first"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {(["all", "issued", "void"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-small font-semibold capitalize transition-all duration-200 ${
              statusFilter === s
                ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20"
                : "border border-border bg-surface text-text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {s === "all" ? "All Bills" : s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-small text-error">
          Could not load bill history — check your connection and try again.
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data && data.invoices.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-body font-medium text-text">No bills found</p>
          <p className="text-small text-text-muted">
            Generated bills will appear here in chronological order.
          </p>
        </div>
      )}

      {/* Bills table */}
      {!isLoading && !isError && data && data.invoices.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-[20px] border border-border/60 bg-surface/80 p-1 shadow-md backdrop-blur-xl">
            <div className="overflow-hidden rounded-[15px] border border-border/40 bg-surface">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/40 bg-background/50">
                    <th className="whitespace-nowrap px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      #
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Invoice No.
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Date & Time
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Items
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Total
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {data.invoices.map((inv, idx) => {
                    const badge = STATUS_BADGE[inv.status];
                    const serialNo = (data.page - 1) * 20 + idx + 1;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(`/admin/invoices/${inv.id}`)}
                        className="group cursor-pointer transition-colors hover:bg-primary/[0.03]"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-small text-text-muted/70">
                          {serialNo}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="font-heading text-body font-bold text-text transition-colors group-hover:text-primary">
                            #{inv.invoiceNumber}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-small font-medium text-text-muted">
                          {formatDateTime(inv.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-background font-medium text-text shadow-sm">
                            {inv.items.length}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <span className="font-heading text-body font-bold text-text">
                            {formatMoney(inv.total)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <button
                            type="button"
                            disabled={isDownloading === inv.id}
                            onClick={(e) => handleDownloadPdf(e, inv)}
                            title="Download PDF"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all hover:scale-110 hover:bg-primary hover:text-white hover:shadow-md disabled:opacity-50"
                          >
                            {isDownloading === inv.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/80 px-6 py-4 shadow-sm backdrop-blur-md">
              <p className="text-small font-medium text-text-muted">
                Page <span className="font-bold text-text">{data.page}</span> of <span className="font-bold text-text">{data.totalPages}</span> · {data.total} bills total
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
