import { Router } from "express";
import * as messageTemplateController from "../controllers/message-template.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authenticate);

// Marketing module is Owner/Manager only end to end (see
// `whatsapp-config.routes.ts`, `contact.routes.ts`) — both roles can view
// and sync templates, matching Contacts' "no manage/view split" pattern
// rather than Setup's Owner-only WhatsApp-connection edit.
const canAccess = authorize("owner", "manager");

router.get("/", canAccess, messageTemplateController.listMessageTemplates);
router.post("/sync", canAccess, messageTemplateController.syncMessageTemplates);

export default router;
