import { Router } from "express";
import * as whatsappWebhookController from "../controllers/whatsapp-webhook.controller";
import { verifyMetaWebhookSignature } from "../middleware/verify-meta-signature";

const router = Router();

// Deliberately no `authenticate` — Meta calls these two routes directly,
// with no session of ours to attach an `Authorization` header to. Mounted
// under `/api/public` (`public.routes.ts`) alongside the public website
// router, both entirely outside the authenticated `/api` router tree.
//
// `GET` is Meta's one-time webhook verification handshake
// (`whatsapp-webhook.controller.ts` `verifyWebhook`). `POST` is every
// subsequent event delivery, guarded by `verifyMetaWebhookSignature` — the
// real security boundary here, since there's no login wall on this route
// at all (see that middleware's own doc comment).
router.get("/", whatsappWebhookController.verifyWebhook);
router.post("/", verifyMetaWebhookSignature, whatsappWebhookController.receiveWebhookEvent);

export default router;
