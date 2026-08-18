import { Router } from "express";
import * as invoiceController from "../controllers/invoice.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  generateInvoiceSchema,
  invoiceIdParamsSchema,
  orderIdParamsSchema,
  voidInvoiceSchema,
} from "../validators/invoice.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Billing/Settle: Owner/Manager/Cashier create+settle bills.
// Server/Waiter has no billing access. Void restricted to Owner/Manager
// only (PRD §3.10), fully audit-logged.
const canBill = authorize("owner", "manager", "cashier");
const canVoid = authorize("owner", "manager");

router.post(
  "/:orderId/generate",
  canBill,
  validate(orderIdParamsSchema, "params"),
  validate(generateInvoiceSchema),
  invoiceController.generateInvoice,
);
router.get(
  "/by-order/:orderId",
  canBill,
  validate(orderIdParamsSchema, "params"),
  invoiceController.getInvoiceByOrder,
);
router.get(
  "/:id",
  canBill,
  validate(invoiceIdParamsSchema, "params"),
  invoiceController.getInvoice,
);
router.get(
  "/:id/pdf",
  canBill,
  validate(invoiceIdParamsSchema, "params"),
  invoiceController.getInvoicePdf,
);
router.post(
  "/:id/void",
  canVoid,
  validate(invoiceIdParamsSchema, "params"),
  validate(voidInvoiceSchema),
  invoiceController.voidInvoice,
);

export default router;
