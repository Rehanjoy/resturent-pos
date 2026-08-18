import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { createPaymentSchema } from "../validators/payment.validators";

const router = Router();

router.use(authenticate);

// Same Billing/Settle RBAC as invoices (PRD §2): Owner/Manager/Cashier only.
const canBill = authorize("owner", "manager", "cashier");

router.post("/", canBill, validate(createPaymentSchema), paymentController.createPayment);

export default router;
