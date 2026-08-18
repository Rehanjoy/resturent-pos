import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import {
  Restaurant,
  type RestaurantAddress,
  type RestaurantDocument,
  type TaxConfigEntry,
  type DiscountApprovalThreshold,
} from "../models/restaurant.model";
import type { PaymentMode } from "../models/payment.model";
import { recordAuditLog } from "./audit-log.service";

export interface SettingsDto {
  id: string;
  name: string;
  slug: string;
  address?: RestaurantAddress;
  gstNumber?: string;
  logoUrl?: string;
  taxConfig: TaxConfigEntry[];
  discountApprovalThreshold: DiscountApprovalThreshold;
  enabledPaymentModes: PaymentMode[];
  updatedAt: Date;
}

function toDto(restaurant: HydratedDocument<RestaurantDocument>): SettingsDto {
  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    slug: restaurant.slug,
    address: restaurant.address,
    gstNumber: restaurant.gstNumber,
    logoUrl: restaurant.logoUrl,
    taxConfig: restaurant.taxConfig,
    discountApprovalThreshold: restaurant.settings.discountApprovalThreshold,
    enabledPaymentModes: restaurant.settings.enabledPaymentModes,
    updatedAt: restaurant.updatedAt,
  };
}

async function findRestaurantOrThrow(
  restaurantId: string,
): Promise<HydratedDocument<RestaurantDocument>> {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  }
  return restaurant;
}

export async function getSettings(restaurantId: string): Promise<SettingsDto> {
  const restaurant = await findRestaurantOrThrow(restaurantId);
  return toDto(restaurant);
}

/**
 * Narrow read used by the Settle Bill screen's `PaymentPanel` (any billing
 * role — Owner/Manager/Cashier). The full `GET /api/settings` resource
 * stays Owner/Manager-only per PRD §2, but a Cashier who can already take
 * payments needs to know which modes are enabled to render the right
 * buttons — the same field `payment.service.ts` already reads server-side
 * to validate every settlement regardless of who's asking.
 */
export async function getEnabledPaymentModes(restaurantId: string): Promise<PaymentMode[]> {
  const restaurant = await findRestaurantOrThrow(restaurantId);
  return restaurant.settings.enabledPaymentModes;
}

export interface UpdateProfileInput {
  name?: string;
  address?: RestaurantAddress;
  gstNumber?: string;
  logoUrl?: string;
}

/**
 * Restaurant identity fields (PRD §3.14) — Owner-only at the route level
 * (see the judgment call documented in settings.routes.ts).
 */
export async function updateProfile(
  restaurantId: string,
  staffId: string,
  input: UpdateProfileInput,
): Promise<SettingsDto> {
  const restaurant = await findRestaurantOrThrow(restaurantId);

  const beforeValue = {
    name: restaurant.name,
    address: restaurant.address,
    gstNumber: restaurant.gstNumber,
    logoUrl: restaurant.logoUrl,
  };

  if (input.name !== undefined) restaurant.name = input.name;
  if (input.address !== undefined) restaurant.address = input.address;
  if (input.gstNumber !== undefined) restaurant.gstNumber = input.gstNumber;
  if (input.logoUrl !== undefined) restaurant.logoUrl = input.logoUrl || undefined;

  await restaurant.save();

  await recordAuditLog({
    restaurantId: restaurant._id,
    staffId: new Types.ObjectId(staffId),
    action: "settings.profile_updated",
    entityType: "Restaurant",
    entityId: restaurant._id.toString(),
    beforeValue,
    afterValue: {
      name: restaurant.name,
      address: restaurant.address,
      gstNumber: restaurant.gstNumber,
      logoUrl: restaurant.logoUrl,
    },
  });

  return toDto(restaurant);
}

/**
 * Replaces the full tax slab list (PRD §3.14 "Tax configuration (multiple
 * tax types/rates)") — this is exactly what `invoice.service.ts`
 * `generateInvoice` reads to build a new invoice's `taxLines`, so a change
 * here takes effect on the next bill generated, never retroactively (issued
 * invoices are immutable, see invoice.model.ts).
 */
export async function updateTaxConfig(
  restaurantId: string,
  staffId: string,
  taxConfig: TaxConfigEntry[],
): Promise<SettingsDto> {
  const restaurant = await findRestaurantOrThrow(restaurantId);
  const beforeValue = { taxConfig: restaurant.taxConfig };

  restaurant.taxConfig = taxConfig;
  await restaurant.save();

  await recordAuditLog({
    restaurantId: restaurant._id,
    staffId: new Types.ObjectId(staffId),
    action: "settings.tax_config_updated",
    entityType: "Restaurant",
    entityId: restaurant._id.toString(),
    beforeValue,
    afterValue: { taxConfig: restaurant.taxConfig },
  });

  return toDto(restaurant);
}

export async function updateDiscountThreshold(
  restaurantId: string,
  staffId: string,
  threshold: DiscountApprovalThreshold,
): Promise<SettingsDto> {
  const restaurant = await findRestaurantOrThrow(restaurantId);
  const beforeValue = { discountApprovalThreshold: restaurant.settings.discountApprovalThreshold };

  restaurant.settings.discountApprovalThreshold = threshold;
  await restaurant.save();

  await recordAuditLog({
    restaurantId: restaurant._id,
    staffId: new Types.ObjectId(staffId),
    action: "settings.discount_threshold_updated",
    entityType: "Restaurant",
    entityId: restaurant._id.toString(),
    beforeValue,
    afterValue: { discountApprovalThreshold: restaurant.settings.discountApprovalThreshold },
  });

  return toDto(restaurant);
}

/**
 * Follow-up noted in the handover report: the Billing/Settle Bill screen's
 * `PaymentPanel` now filters its mode buttons down to this list (see
 * `frontend/components/billing/payment-panel.tsx`), so this setting is
 * enforced end-to-end, not just stored.
 */
export async function updatePaymentModes(
  restaurantId: string,
  staffId: string,
  enabledPaymentModes: PaymentMode[],
): Promise<SettingsDto> {
  const restaurant = await findRestaurantOrThrow(restaurantId);
  const beforeValue = { enabledPaymentModes: restaurant.settings.enabledPaymentModes };

  restaurant.settings.enabledPaymentModes = enabledPaymentModes;
  await restaurant.save();

  await recordAuditLog({
    restaurantId: restaurant._id,
    staffId: new Types.ObjectId(staffId),
    action: "settings.payment_modes_updated",
    entityType: "Restaurant",
    entityId: restaurant._id.toString(),
    beforeValue,
    afterValue: { enabledPaymentModes: restaurant.settings.enabledPaymentModes },
  });

  return toDto(restaurant);
}
