import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  categoryIdParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validators";

const router = Router();

router.use(authenticate);

// Menu access per PRD §2: every role can at least view the menu; only
// Owner/Manager can write (PRD §3.8).
const canManage = authorize("owner", "manager");

router.get("/", categoryController.listCategories);
router.post(
  "/",
  canManage,
  validate(createCategorySchema),
  categoryController.createCategory,
);
router.patch(
  "/:id",
  canManage,
  validate(categoryIdParamsSchema, "params"),
  validate(updateCategorySchema),
  categoryController.updateCategory,
);
router.delete(
  "/:id",
  canManage,
  validate(categoryIdParamsSchema, "params"),
  categoryController.deleteCategory,
);

export default router;
