export type DiscountType = "flat" | "percent";
export type PaymentMode = "cash" | "card" | "upi";
export type InvoiceStatus = "issued" | "void";

/** Mirrors `backend/src/services/invoice.service.ts` `InvoiceItemDto`. */
export interface InvoiceItem {
  menuItemId: string;
  nameSnapshot: string;
  /** Integer paise — see `lib/format.ts`. */
  priceSnapshot: number;
  qty: number;
}

/** Mirrors `backend/src/services/invoice.service.ts` `InvoiceDiscountDto`. */
export interface InvoiceDiscount {
  type: DiscountType;
  value: number;
  amountApplied: number;
  approvedByStaffId?: string;
}

/** Mirrors `backend/src/services/invoice.service.ts` `InvoiceTaxLineDto`. */
export interface InvoiceTaxLine {
  name: string;
  ratePercent: number;
  amount: number;
}

/** Mirrors `backend/src/services/invoice.service.ts` `InvoiceDto`. */
export interface Invoice {
  id: string;
  restaurantId: string;
  orderId: string;
  invoiceNumber: number;
  items: InvoiceItem[];
  subtotal: number;
  discount?: InvoiceDiscount;
  taxLines: InvoiceTaxLine[];
  total: number;
  status: InvoiceStatus;
  voidReason?: string;
  voidedByStaffId?: string;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `backend/src/services/payment.service.ts` `PaymentDto`. */
export interface Payment {
  id: string;
  restaurantId: string;
  invoiceId: string;
  mode: PaymentMode;
  amount: number;
  createdAt: string;
}
