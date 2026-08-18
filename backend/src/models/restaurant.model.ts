import { Schema, model, type Types } from "mongoose";

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

export interface RestaurantDocument {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  address?: RestaurantAddress;
  gstNumber?: string;
  logoUrl?: string;
  taxConfig: TaxConfigEntry[];
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
  },
  { timestamps: true },
);

export const Restaurant = model<RestaurantDocument>(
  "Restaurant",
  restaurantSchema,
);
