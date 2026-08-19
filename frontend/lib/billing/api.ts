import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token-store";
import type { Order } from "@/lib/orders/types";
import type { DiscountType, Invoice, Payment, PaymentMode } from "./types";

// Mirrors the base URL resolution in lib/socket.ts — the PDF download needs
// a raw `fetch` (not the JSON-only `api` client) so it can read a binary
// response body, but it still has to attach the same Authorization header
// and origin as every other API call.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export interface GenerateInvoiceInput {
  discount?: { type: DiscountType; value: number };
  approverEmail?: string;
  approverPassword?: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  payments: { mode: PaymentMode; amount: number }[];
}

/**
 * Typed endpoint calls for the Billing & Settlement module, all going
 * through the single transport client in `lib/api.ts` (same pattern as
 * `lib/orders/api.ts`).
 */
export const billingApi = {
  listInvoices: (opts?: { page?: number; limit?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    return api.get<{ invoices: Invoice[]; total: number; page: number; totalPages: number }>(
      `/api/invoices${qs ? `?${qs}` : ""}`,
    );
  },

  generateInvoice: (orderId: string, input: GenerateInvoiceInput) =>
    api.post<{ invoice: Invoice }>(`/api/invoices/${orderId}/generate`, input),

  getInvoice: (invoiceId: string) =>
    api.get<{ invoice: Invoice; payments: Payment[] }>(`/api/invoices/${invoiceId}`),

  /** Resumes mid-settlement after a reload: looks up the invoice already
   * issued for an order, if any (`invoice` is null when none exists yet). */
  getInvoiceByOrder: (orderId: string) =>
    api.get<{ invoice: Invoice | null }>(`/api/invoices/by-order/${orderId}`),

  settlePayment: (input: CreatePaymentInput) =>
    api.post<{ invoice: Invoice; payments: Payment[]; order: Order }>("/api/payments", input),

  voidInvoice: (invoiceId: string, reason: string) =>
    api.post<{ invoice: Invoice }>(`/api/invoices/${invoiceId}/void`, { reason }),

  /** Fetches the invoice PDF as a Blob. Goes around `lib/api.ts`'s `request`
   * helper on purpose — that helper only ever parses JSON bodies, and would
   * silently discard a binary PDF response. */
  fetchInvoicePdf: async (invoiceId: string): Promise<Blob> => {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!response.ok) {
      throw new ApiError(
        "Could not download the invoice PDF. Check your connection and try again.",
        response.status,
        "PDF_DOWNLOAD_ERROR",
      );
    }
    return response.blob();
  },
};
