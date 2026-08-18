import { Schema, model, type Types } from "mongoose";

export const INVOICE_STATUSES = ["issued", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DISCOUNT_TYPES = ["flat", "percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface InvoiceItemSnapshot {
  menuItemId: Types.ObjectId;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
}

export interface InvoiceDiscount {
  type: DiscountType;
  value: number;
  /** Integer paise actually taken off the subtotal — see
   * `services/invoice.service.ts` `computeDiscountAmount`. */
  amountApplied: number;
  /** Set only when the discount exceeded `Restaurant.settings
   * .discountApprovalThreshold` and a manager/owner's credentials were
   * verified server-side (PRD §3.10 "manager-approval lock"). */
  approvedByStaffId?: Types.ObjectId;
}

export interface InvoiceTaxLine {
  name: string;
  ratePercent: number;
  /** Integer paise, computed from the post-discount subtotal. */
  amount: number;
}

export interface InvoiceDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  orderId: Types.ObjectId;
  /** Sequential per restaurant, assigned once via `Counter` — never reused,
   * never edited (PRD §7). */
  invoiceNumber: number;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  discount?: InvoiceDiscount;
  taxLines: InvoiceTaxLine[];
  total: number;
  status: InvoiceStatus;
  voidReason?: string;
  voidedByStaffId?: Types.ObjectId;
  createdByStaffId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<InvoiceItemSnapshot>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    nameSnapshot: { type: String, required: true, trim: true },
    priceSnapshot: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const invoiceDiscountSchema = new Schema<InvoiceDiscount>(
  {
    type: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true, min: 0 },
    amountApplied: { type: Number, required: true, min: 0 },
    approvedByStaffId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const invoiceTaxLineSchema = new Schema<InvoiceTaxLine>(
  {
    name: { type: String, required: true, trim: true },
    ratePercent: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * Append-only per PRD §7: once issued, an invoice's items/subtotal/discount
 * /taxLines/total are immutable. Voiding (`services/invoice.service.ts`
 * `voidInvoice`) only ever flips `status` to `"void"` and stamps a reason —
 * it never edits the original financial fields or deletes the document.
 * Do not add a route/service path that mutates a non-void invoice's money
 * fields after creation.
 */
const invoiceSchema = new Schema<InvoiceDocument>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    invoiceNumber: { type: Number, required: true },
    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: invoiceDiscountSchema, default: undefined },
    taxLines: { type: [invoiceTaxLineSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, required: true, default: "issued" },
    voidReason: { type: String, trim: true },
    voidedByStaffId: { type: Schema.Types.ObjectId, ref: "User" },
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Required compound index (task spec / PRD §7) — guarantees the DB itself
// rejects a duplicate invoice number for a restaurant even if the atomic
// counter were ever bypassed.
invoiceSchema.index({ restaurantId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ restaurantId: 1, createdAt: -1 });
invoiceSchema.index({ restaurantId: 1, orderId: 1 });

export const Invoice = model<InvoiceDocument>("Invoice", invoiceSchema);
