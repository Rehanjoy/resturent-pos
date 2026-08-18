import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createOrderSchema,
  editOrderItemsSchema,
  orderIdParamsSchema,
  orderListQuerySchema,
  serveOrderSchema,
  voidOrderSchema,
} from "../validators/order.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Orders column: Owner/Manager Full; Cashier "Create/Settle";
// Server/Waiter "Create/Edit"; Chef "View (assigned)". Settle lives in the
// Billing module, not here. Judgment call on the rest, since the matrix's
// columns are coarse-grained and don't literally spell out every action:
// composing an order (adding items), sending a batch to the kitchen, and
// serving ready items are all treated as part of "building/running" an
// order end-to-end, open to every role that can create one — a Cashier
// who could "Create" an order but not add a single item to it would be a
// broken feature. Only voiding (destructive + audited) is narrowed to the
// literal Owner/Manager rule from PRD §3.3/§3.10.
const canView = authorize("owner", "manager", "cashier", "server", "chef");
const canBuild = authorize("owner", "manager", "cashier", "server");
const canVoid = authorize("owner", "manager");

router.get("/", canView, validate(orderListQuerySchema, "query"), orderController.listOrders);
router.get(
  "/:id",
  canView,
  validate(orderIdParamsSchema, "params"),
  orderController.getOrder,
);
router.post("/", canBuild, validate(createOrderSchema), orderController.createOrder);
router.patch(
  "/:id",
  canBuild,
  validate(orderIdParamsSchema, "params"),
  validate(editOrderItemsSchema),
  orderController.editOrderItems,
);
router.post(
  "/:id/send-kitchen",
  canBuild,
  validate(orderIdParamsSchema, "params"),
  orderController.sendToKitchen,
);
router.post(
  "/:id/serve",
  canBuild,
  validate(orderIdParamsSchema, "params"),
  validate(serveOrderSchema),
  orderController.serveOrder,
);
router.delete(
  "/:id/void",
  canVoid,
  validate(orderIdParamsSchema, "params"),
  validate(voidOrderSchema),
  orderController.voidOrder,
);

export default router;
