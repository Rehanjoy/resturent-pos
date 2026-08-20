import { Router } from "express";
import * as campaignController from "../controllers/marketing-campaign.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  campaignIdParamsSchema,
  createCampaignSchema,
  listCampaignsQuerySchema,
} from "../validators/marketing-campaign.validators";

const router = Router();

router.use(authenticate);

// Same Owner/Manager, no manage/view split as `message-template.routes.ts`
// / `contact.routes.ts` — either role can build and send a campaign.
const canAccess = authorize("owner", "manager");

router.get("/", canAccess, validate(listCampaignsQuerySchema, "query"), campaignController.listCampaigns);
router.post("/", canAccess, validate(createCampaignSchema), campaignController.createCampaign);
router.get(
  "/:id",
  canAccess,
  validate(campaignIdParamsSchema, "params"),
  campaignController.getCampaign,
);
router.get(
  "/:id/recipients",
  canAccess,
  validate(campaignIdParamsSchema, "params"),
  validate(listCampaignsQuerySchema, "query"),
  campaignController.listCampaignRecipients,
);

export default router;
