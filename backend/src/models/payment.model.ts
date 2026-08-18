import { Schema, model, type Types } from "mongoose";

export const PAYMENT_MODES = ["cash", "card", "upi"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface PaymentDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  mode: PaymentMode;
  /** Integer paise. */
  amount: number;
  createdAt: Date;
}

/**
 * One row per payment line on an invoice — split payments across modes
 * (PRD §3.10) are multiple `Payment` documents that must sum to exactly
 * `Invoice.total` (enforced in `services/payment.service.ts`, never here).
 * Append-only, same convention as `AuditLog`: no update/delete path exists
 * anywhere in this codebase for this model.
 */
const paymentSchema = new Schema<PaymentDocument>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    amount: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

paymentSchema.index({ restaurantId: 1, invoiceId: 1 });
paymentSchema.index({ restaurantId: 1, createdAt: -1 });

export const Payment = model<PaymentDocument>("Payment", paymentSchema);
