import { Router } from "express";
import * as kitchenController from "../controllers/kitchen.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { itemReadySchema, kotIdParamsSchema } from "../validators/kitchen.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Kitchen(KDS) column: Owner/Manager/Chef Full; Cashier/Server View
// only — no Mark Ready actions for the front-of-house roles.
const canView = authorize("owner", "manager", "chef", "cashier", "server");
const canManage = authorize("owner", "manager", "chef");

router.get("/tickets", canView, kitchenController.listTickets);
router.patch(
  "/tickets/:kotId/item-ready",
  canManage,
  validate(kotIdParamsSchema, "params"),
  validate(itemReadySchema),
  kitchenController.markItemReady,
);
router.patch(
  "/tickets/:kotId/mark-all-ready",
  canManage,
  validate(kotIdParamsSchema, "params"),
  kitchenController.markAllReady,
);

export default router;
