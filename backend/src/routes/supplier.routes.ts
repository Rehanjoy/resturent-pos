import { Router } from "express";
import * as supplierController from "../controllers/supplier.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createSupplierSchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from "../validators/supplier.validators";

const router = Router();

router.use(authenticate);

// Same PRD §2 Inventory RBAC as the rest of the module — see
// `inventory-category.routes.ts`. No DELETE route: suppliers aren't
// exposed as deletable in this build (an item can still reference one via
// `supplierId`), only listable/creatable/editable.
const canView = authorize("owner", "manager", "inventory_manager", "chef");
const canManage = authorize("owner", "manager", "inventory_manager");

router.get("/", canView, supplierController.listSuppliers);
router.post("/", canManage, validate(createSupplierSchema), supplierController.createSupplier);
router.patch(
  "/:id",
  canManage,
  validate(supplierIdParamsSchema, "params"),
  validate(updateSupplierSchema),
  supplierController.updateSupplier,
);

export default router;
