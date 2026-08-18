import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { exportReportQuerySchema, reportRangeQuerySchema } from "../validators/report.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Reports column: Owner/Manager "Full", Cashier "sales only" —
// interpreted as every report tab except Staff Performance (individual
// staff productivity isn't appropriate for a Cashier to view about their
// peers). Staff Performance therefore gets its own, stricter guard below,
// independent of `canViewSales` — never exposed to Cashier via any shared
// route.
const canViewSales = authorize("owner", "manager", "cashier");
const canViewStaffPerformance = authorize("owner", "manager");

router.get("/sales", canViewSales, validate(reportRangeQuerySchema, "query"), reportController.getSalesReport);
router.get(
  "/top-dishes",
  canViewSales,
  validate(reportRangeQuerySchema, "query"),
  reportController.getTopDishesReport,
);
router.get(
  "/staff-performance",
  canViewStaffPerformance,
  validate(reportRangeQuerySchema, "query"),
  reportController.getStaffPerformanceReport,
);
router.get(
  "/export",
  canViewSales,
  validate(exportReportQuerySchema, "query"),
  reportController.exportReport,
);

export default router;
