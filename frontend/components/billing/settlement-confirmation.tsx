"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { billingApi } from "@/lib/billing/api";
import type { Invoice, Payment } from "@/lib/billing/types";

const MODE_LABEL: Record<Payment["mode"], string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
};

function paymentSummary(payments: Payment[]): string {
  const modes = Array.from(new Set(payments.map((payment) => MODE_LABEL[payment.mode])));
  return modes.join(" + ");
}

/**
 * Success state after `POST /api/payments` — the copy follows the brand
 * kit's confirmation example verbatim in shape ("Bill #1042 settled —
 * ₹1,240 via UPI.") per `docs/02-brand-kit.md` §4 tone of voice.
 */
export function SettlementConfirmation({ invoice, payments }: { invoice: Invoice; payments: Payment[] }) {
  const router = useRouter();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloadError(null);
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
      setDownloadError("Could not download the invoice PDF. Check your connection and try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
        &#10003;
      </div>
      <div>
        <h2 className="font-heading text-h2 font-semibold text-text">
          Bill #{invoice.invoiceNumber} settled
        </h2>
        <p className="mt-1 text-body text-text-muted">
          {formatMoney(invoice.total)} via {paymentSummary(payments)}.
        </p>
      </div>

      {downloadError && <p className="text-small text-error">{downloadError}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="rounded-md bg-accent px-4 py-2.5 text-button text-white disabled:opacity-60"
        >
          {isDownloading ? "Preparing…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/tables")}
          className="rounded-md border border-border px-4 py-2.5 text-button text-text-muted hover:text-text"
        >
          Back to Tables
        </button>
      </div>
    </div>
  );
}
