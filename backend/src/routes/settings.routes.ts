import { Router } from "express";
import * as settingsController from "../controllers/settings.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  updateDiscountThresholdSchema,
  updatePaymentModesSchema,
  updateProfileSchema,
  updateTaxConfigSchema,
} from "../validators/settings.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Settings column: Owner "Full", Manager "Partial", every other role
// "—" (no access, not even view — gated below by `canView`).
//
// The PRD doesn't spell out exactly what "Partial" means for Manager, so
// this is a judgment call (documented in the handover report): a Manager
// can view every setting and edit the *operational* ones that billing
// depends on day to day (tax slabs, discount approval threshold, payment
// mode toggles), but cannot edit the restaurant's core identity (name,
// GST number, logo) — those are legal/business-identity fields an Owner
// should control, not something a shift Manager changes on the fly.
const canView = authorize("owner", "manager");
const canEditOperational = authorize("owner", "manager");
const ownerOnly = authorize("owner");
// Narrow read for the billing screen's payment-mode selector — same
// roles allowed to actually take a payment (`payment.routes.ts`), not the
// full Owner/Manager-only Settings audience. See the doc comment on
// `settingsService.getEnabledPaymentModes`.
const canReadPaymentModes = authorize("owner", "manager", "cashier");

router.get("/", canView, settingsController.getSettings);
router.get("/payment-modes", canReadPaymentModes, settingsController.getPaymentModes);
router.patch(
  "/profile",
  ownerOnly,
  validate(updateProfileSchema),
  settingsController.updateProfile,
);
router.patch(
  "/tax-config",
  canEditOperational,
  validate(updateTaxConfigSchema),
  settingsController.updateTaxConfig,
);
router.patch(
  "/discount-threshold",
  canEditOperational,
  validate(updateDiscountThresholdSchema),
  settingsController.updateDiscountThreshold,
);
router.patch(
  "/payment-modes",
  canEditOperational,
  validate(updatePaymentModesSchema),
  settingsController.updatePaymentModes,
);

export default router;
