import { Router } from "express";
import * as whatsappConfigController from "../controllers/whatsapp-config.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { saveWhatsappConfigSchema } from "../validators/whatsapp-config.validators";

const router = Router();

router.use(authenticate);

// Marketing module is Owner/Manager only, no other role gets a nav entry
// or access at all (see `frontend/components/layout/sidebar.tsx`). Within
// that, connecting/disconnecting the business's WhatsApp number is an
// identity-level decision — same category as the Website Builder module's
// Owner-full/Manager-view-only split (`website.routes.ts`), not the usual
// "Manager can edit operational stuff" pattern most other modules follow.
const canView = authorize("owner", "manager");
const canManage = authorize("owner");

router.get("/", canView, whatsappConfigController.getWhatsappConfig);
router.patch(
  "/",
  canManage,
  validate(saveWhatsappConfigSchema),
  whatsappConfigController.saveWhatsappConfig,
);

export default router;
