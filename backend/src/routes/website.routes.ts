import { Router } from "express";
import * as websiteController from "../controllers/website.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { addGalleryImageSchema, updateWebsiteContentSchema } from "../validators/website.validators";

const router = Router();

router.use(authenticate);

// PRD §2 Website column: Owner "Full", Manager "View", every other role
// "—" (no access at all, not even view). This is a real deviation from
// every other module's "Manager can edit operational stuff" pattern — the
// PRD is explicit here, so it's followed literally rather than inferred:
// Manager can read `GET /content` but is blocked (403) from every write
// path (`PATCH /content`, `POST /media`).
const canView = authorize("owner", "manager");
const canManage = authorize("owner");

router.get("/content", canView, websiteController.getWebsiteContent);
router.patch(
  "/content",
  canManage,
  validate(updateWebsiteContentSchema),
  websiteController.updateWebsiteContent,
);
// Stands in for a real multipart upload — see the doc comment on
// `website.service.ts` `addGalleryImage`.
router.post(
  "/media",
  canManage,
  validate(addGalleryImageSchema),
  websiteController.addGalleryImage,
);

export default router;
