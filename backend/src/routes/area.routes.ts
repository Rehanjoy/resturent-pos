import { Router } from "express";
import * as areaController from "../controllers/area.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  areaIdParamsSchema,
  createAreaSchema,
  updateAreaSchema,
} from "../validators/area.validators";

const router = Router();

router.use(authenticate);

// Tables/Areas access per PRD §2 RBAC matrix: Owner/Manager full, Cashier
// and Server can view. Chef and Inventory Manager have no access to this
// module at all ("—" in the matrix).
const canView = authorize("owner", "manager", "cashier", "server");
const canManage = authorize("owner", "manager");

router.get("/", canView, areaController.listAreas);
router.post("/", canManage, validate(createAreaSchema), areaController.createArea);
router.patch(
  "/:id",
  canManage,
  validate(areaIdParamsSchema, "params"),
  validate(updateAreaSchema),
  areaController.updateArea,
);
router.delete(
  "/:id",
  canManage,
  validate(areaIdParamsSchema, "params"),
  areaController.deleteArea,
);

export default router;
