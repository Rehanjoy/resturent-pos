import { Router } from "express";
import * as inventoryCategoryController from "../controllers/inventory-category.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createInventoryCategorySchema,
  inventoryCategoryIdParamsSchema,
  updateInventoryCategorySchema,
} from "../validators/inventory-category.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Inventory column: Owner/Manager/Inventory Manager "Full"; Chef
// "View (deduction only)" — visibility into what's being consumed, no
// write access at all. Cashier/Server have no access to this module.
const canView = authorize("owner", "manager", "inventory_manager", "chef");
const canManage = authorize("owner", "manager", "inventory_manager");

router.get("/", canView, inventoryCategoryController.listInventoryCategories);
router.post(
  "/",
  canManage,
  validate(createInventoryCategorySchema),
  inventoryCategoryController.createInventoryCategory,
);
router.patch(
  "/:id",
  canManage,
  validate(inventoryCategoryIdParamsSchema, "params"),
  validate(updateInventoryCategorySchema),
  inventoryCategoryController.updateInventoryCategory,
);
router.delete(
  "/:id",
  canManage,
  validate(inventoryCategoryIdParamsSchema, "params"),
  inventoryCategoryController.deleteInventoryCategory,
);

export default router;
