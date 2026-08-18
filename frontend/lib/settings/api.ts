import { api } from "@/lib/api";
import type {
  DiscountApprovalThreshold,
  PaymentMode,
  RestaurantAddress,
  RestaurantSettings,
  TaxConfigEntry,
} from "./types";

/**
 * Typed endpoint calls for the Settings module (PRD §3.14), all going
 * through the single transport client in `lib/api.ts`.
 */
export const settingsApi = {
  get: () => api.get<{ settings: RestaurantSettings }>("/api/settings"),

  /** Available to any billing role (Owner/Manager/Cashier), unlike the rest
   * of this module — see `backend/src/routes/settings.routes.ts`. */
  getPaymentModes: () => api.get<{ enabledPaymentModes: PaymentMode[] }>("/api/settings/payment-modes"),

  updateProfile: (input: {
    name?: string;
    address?: RestaurantAddress;
    gstNumber?: string;
    logoUrl?: string;
  }) => api.patch<{ settings: RestaurantSettings }>("/api/settings/profile", input),

  updateTaxConfig: (taxConfig: TaxConfigEntry[]) =>
    api.patch<{ settings: RestaurantSettings }>("/api/settings/tax-config", { taxConfig }),

  updateDiscountThreshold: (threshold: DiscountApprovalThreshold) =>
    api.patch<{ settings: RestaurantSettings }>("/api/settings/discount-threshold", threshold),

  updatePaymentModes: (enabledPaymentModes: PaymentMode[]) =>
    api.patch<{ settings: RestaurantSettings }>("/api/settings/payment-modes", {
      enabledPaymentModes,
    }),
};
