import { Router } from "express";
import * as menuItemController from "../controllers/menu-item.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createMenuItemSchema,
  menuItemIdParamsSchema,
  menuItemListQuerySchema,
  updateMenuItemSchema,
} from "../validators/menu-item.validators";

const router = Router();

router.use(authenticate);

// Every authenticated role can view the menu (PRD §2 Menu column: View at
// minimum for every role); only Owner/Manager can write (PRD §3.8),
// including the "86 an item" availability toggle, which is just a PATCH.
const canManage = authorize("owner", "manager");

router.get(
  "/",
  validate(menuItemListQuerySchema, "query"),
  menuItemController.listMenuItems,
);
router.post(
  "/",
  canManage,
  validate(createMenuItemSchema),
  menuItemController.createMenuItem,
);
router.patch(
  "/:id",
  canManage,
  validate(menuItemIdParamsSchema, "params"),
  validate(updateMenuItemSchema),
  menuItemController.updateMenuItem,
);
router.delete(
  "/:id",
  canManage,
  validate(menuItemIdParamsSchema, "params"),
  menuItemController.deleteMenuItem,
);

export default router;
