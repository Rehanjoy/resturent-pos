import { Router } from "express";
import * as tableController from "../controllers/table.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createTableSchema,
  tableIdParamsSchema,
  tableListQuerySchema,
  updateTableSchema,
  updateTableStatusSchema,
} from "../validators/table.validators";

const router = Router();

router.use(authenticate);

// Same view/manage split as areas (PRD §2). Status changes get their own,
// wider-access guard below — Server can flip a table's status (seat/clean)
// without being able to create/edit/delete tables structurally.
// Chef/KDS reads table names to label kitchen tickets. This grants read-only
// table metadata; structural edits and status changes remain separately gated.
const canView = authorize("owner", "manager", "cashier", "server", "chef");
const canManage = authorize("owner", "manager");
const canChangeStatus = authorize("owner", "manager", "server");

router.get(
  "/",
  canView,
  validate(tableListQuerySchema, "query"),
  tableController.listTables,
);
router.post("/", canManage, validate(createTableSchema), tableController.createTable);
router.patch(
  "/:id",
  canManage,
  validate(tableIdParamsSchema, "params"),
  validate(updateTableSchema),
  tableController.updateTable,
);
router.delete(
  "/:id",
  canManage,
  validate(tableIdParamsSchema, "params"),
  tableController.deleteTable,
);
router.patch(
  "/:id/status",
  canChangeStatus,
  validate(tableIdParamsSchema, "params"),
  validate(updateTableStatusSchema),
  tableController.updateTableStatus,
);

export default router;
