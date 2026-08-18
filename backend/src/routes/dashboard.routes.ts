import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authenticate);

// PRD §2 Dashboard column: Owner/Manager "Full", Cashier "View" — every
// other role (Server/Chef/Inventory Manager) has no access at all, matching
// the nav rail's role filter in `frontend/app/admin/layout.tsx`. This is a
// single read-only endpoint, so "Full" vs "View" collapses to the same GET
// route for both.
const canView = authorize("owner", "manager", "cashier");

router.get("/summary", canView, dashboardController.getSummary);

export default router;
