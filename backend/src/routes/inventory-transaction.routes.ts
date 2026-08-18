import { Router } from "express";
import * as inventoryTransactionController from "../controllers/inventory-transaction.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { inventoryTransactionListQuerySchema } from "../validators/inventory-transaction.validators";

const router = Router();

router.use(authenticate);

// Read-only audit/purchase-history view — same PRD §2 Inventory RBAC as
// the rest of the module (Chef included, "view (deduction only)").
const canView = authorize("owner", "manager", "inventory_manager", "chef");

router.get(
  "/",
  canView,
  validate(inventoryTransactionListQuerySchema, "query"),
  inventoryTransactionController.listInventoryTransactions,
);

export default router;
