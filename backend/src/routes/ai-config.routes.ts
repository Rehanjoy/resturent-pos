import { Router } from "express";
import * as aiConfigController from "../controllers/ai-config.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { saveAiConfigSchema } from "../validators/ai-config.validators";

const router = Router();

router.use(authenticate);

// Same Owner-full/Manager-view-only split as `whatsapp-config.routes.ts` —
// the Gemini API key and the auto-reply on/off switch are identity/cost-
// level decisions for the restaurant, not day-to-day operational settings.
const canView = authorize("owner", "manager");
const canManage = authorize("owner");

router.get("/", canView, aiConfigController.getAiConfig);
router.patch("/", canManage, validate(saveAiConfigSchema), aiConfigController.saveAiConfig);

export default router;
