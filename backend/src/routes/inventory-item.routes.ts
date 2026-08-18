import { Router } from "express";
import * as inventoryItemController from "../controllers/inventory-item.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  adjustInventoryItemSchema,
  createInventoryItemSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  updateInventoryItemSchema,
} from "../validators/inventory-item.validators";

const router = Router();

router.use(authenticate);

// Same PRD §2 Inventory RBAC as the rest of the module — see
// `inventory-category.routes.ts`.
const canView = authorize("owner", "manager", "inventory_manager", "chef");
const canManage = authorize("owner", "manager", "inventory_manager");

router.get(
  "/",
  canView,
  validate(inventoryItemListQuerySchema, "query"),
  inventoryItemController.listInventoryItems,
);
router.post(
  "/",
  canManage,
  validate(createInventoryItemSchema),
  inventoryItemController.createInventoryItem,
);
router.patch(
  "/:id",
  canManage,
  validate(inventoryItemIdParamsSchema, "params"),
  validate(updateInventoryItemSchema),
  inventoryItemController.updateInventoryItem,
);
router.delete(
  "/:id",
  canManage,
  validate(inventoryItemIdParamsSchema, "params"),
  inventoryItemController.deleteInventoryItem,
);
router.post(
  "/:id/adjust",
  canManage,
  validate(inventoryItemIdParamsSchema, "params"),
  validate(adjustInventoryItemSchema),
  inventoryItemController.adjustInventoryItem,
);
router.patch(
  "/:id/reorder-requested",
  canManage,
  validate(inventoryItemIdParamsSchema, "params"),
  inventoryItemController.toggleReorderRequested,
);

export default router;
