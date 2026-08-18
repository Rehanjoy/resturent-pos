export type TaxType = "CGST" | "SGST" | "VAT" | "other";
export type DiscountType = "flat" | "percent";
export type PaymentMode = "cash" | "card" | "upi";

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

/** Mirrors `backend/src/services/settings.service.ts` `SettingsDto`. */
export interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  address?: RestaurantAddress;
  gstNumber?: string;
  logoUrl?: string;
  taxConfig: TaxConfigEntry[];
  discountApprovalThreshold: DiscountApprovalThreshold;
  enabledPaymentModes: PaymentMode[];
  updatedAt: string;
}
