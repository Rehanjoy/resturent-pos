import { Schema, model, type Types } from "mongoose";
import { DISCOUNT_TYPES, type DiscountType } from "./invoice.model";
import { PAYMENT_MODES, type PaymentMode } from "./payment.model";

export type TaxType = "CGST" | "SGST" | "VAT" | "other";

export interface TaxConfigEntry {
  name: string;
  ratePercent: number;
  type: TaxType;
}

export interface RestaurantAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface DiscountApprovalThreshold {
  type: DiscountType;
  /** Percent (0-100) if `type` is "percent", integer paise if "flat". */
  value: number;
}

export interface RestaurantSettings {
  /** A discount at or below this threshold can be applied by any billing
   * role (Owner/Manager/Cashier) without approval; above it, the settle
   * endpoint requires verified manager/owner credentials (PRD §3.10). */
  discountApprovalThreshold: DiscountApprovalThreshold;
  /** Which payment modes the settle-bill screen may record. A full toggle
   * UI belongs to the future Settings screen (PRD §3.14) — this field just
   * needs to exist with a sensible default for the Billing module to read. */
  enabledPaymentModes: PaymentMode[];
}

export interface RestaurantDocument {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  address?: RestaurantAddress;
  gstNumber?: string;
  logoUrl?: string;
  taxConfig: TaxConfigEntry[];
  settings: RestaurantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const taxConfigSchema = new Schema<TaxConfigEntry>(
  {
    name: { type: String, required: true, trim: true },
    ratePercent: { type: Number, required: true, min: 0, max: 100 },
    type: {
      type: String,
      enum: ["CGST", "SGST", "VAT", "other"],
      required: true,
    },
  },
  { _id: false },
);

const addressSchema = new Schema<RestaurantAddress>(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false },
);

const discountApprovalThresholdSchema = new Schema<DiscountApprovalThreshold>(
  {
    type: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const settingsSchema = new Schema<RestaurantSettings>(
  {
    discountApprovalThreshold: {
      type: discountApprovalThresholdSchema,
      required: true,
      default: () => ({ type: "percent", value: 15 }),
    },
    enabledPaymentModes: {
      type: [{ type: String, enum: PAYMENT_MODES }],
      default: () => [...PAYMENT_MODES],
    },
  },
  { _id: false },
);

/**
 * One restaurant per self-hosted deployment in Phase 1 (PRD "Deployment
 * Model"), but the schema stays multi-tenant-ready: every staff-facing
 * collection carries `restaurantId` so a future SaaS mode can host many
 * restaurants in one database without a data model change.
 */
const restaurantSchema = new Schema<RestaurantDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    address: { type: addressSchema, default: undefined },
    gstNumber: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    taxConfig: { type: [taxConfigSchema], default: [] },
    settings: {
      type: settingsSchema,
      required: true,
      default: () => ({
        discountApprovalThreshold: { type: "percent", value: 15 },
        enabledPaymentModes: [...PAYMENT_MODES],
      }),
    },
  },
  { timestamps: true },
);

export const Restaurant = model<RestaurantDocument>(
  "Restaurant",
  restaurantSchema,
);
