import { Router } from "express";
import * as conversationController from "../controllers/conversation.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  conversationIdParamsSchema,
  listConversationsQuerySchema,
  replyToConversationSchema,
} from "../validators/conversation.validators";

const router = Router();

router.use(authenticate);

// Same Owner/Manager, no manage/view split as `marketing-campaign.routes.ts`
// — either role can see and act on the Inbox.
const canAccess = authorize("owner", "manager");

router.get(
  "/",
  canAccess,
  validate(listConversationsQuerySchema, "query"),
  conversationController.listConversations,
);
router.get(
  "/:id",
  canAccess,
  validate(conversationIdParamsSchema, "params"),
  conversationController.getConversation,
);
router.post(
  "/:id/reply",
  canAccess,
  validate(conversationIdParamsSchema, "params"),
  validate(replyToConversationSchema),
  conversationController.replyToConversation,
);
router.patch(
  "/:id/close",
  canAccess,
  validate(conversationIdParamsSchema, "params"),
  conversationController.closeConversation,
);
router.patch(
  "/:id/hand-back-to-bot",
  canAccess,
  validate(conversationIdParamsSchema, "params"),
  conversationController.handBackToBot,
);

export default router;
