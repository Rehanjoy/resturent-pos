import { Router } from "express";
import * as staffController from "../controllers/staff.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  activityLogQuerySchema,
  createStaffSchema,
  staffIdParamsSchema,
  staffSessionParamsSchema,
  updateStaffSchema,
} from "../validators/staff.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Staff column: Owner "Full", Manager "View/Add" — every other role
// has no access at all, not even view. This module's finer-grained
// Manager-vs-Owner boundary (Manager can fully administer frontline staff
// but never touch Owner/Manager accounts) is enforced inside
// staff.service.ts, not here — this gate only decides "in the module or not".
const canAccess = authorize("owner", "manager");

router.get("/", canAccess, staffController.listStaff);
router.get(
  "/:id",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  staffController.getStaff,
);
router.post("/", canAccess, validate(createStaffSchema), staffController.createStaff);
router.patch(
  "/:id",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  validate(updateStaffSchema),
  staffController.updateStaff,
);
router.patch(
  "/:id/deactivate",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  staffController.deactivateStaff,
);
router.patch(
  "/:id/reactivate",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  staffController.reactivateStaff,
);
router.get(
  "/:id/activity-log",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  validate(activityLogQuerySchema, "query"),
  staffController.getStaffActivityLog,
);
router.get(
  "/:id/sessions",
  canAccess,
  validate(staffIdParamsSchema, "params"),
  staffController.listStaffSessions,
);
router.post(
  "/:id/sessions/:sessionId/revoke",
  canAccess,
  validate(staffSessionParamsSchema, "params"),
  staffController.revokeStaffSession,
);

export default router;
