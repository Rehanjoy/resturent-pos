import { Router } from "express";
import * as publicWebsiteController from "../controllers/public-website.controller";
import { validate } from "../middleware/validate";
import { publicRateLimiter } from "../middleware/rate-limit";
import { restaurantSlugParamsSchema } from "../validators/website.validators";
import whatsappWebhookRoutes from "./whatsapp-webhook.routes";
import { publicDiningRoutes } from "./dining.routes";
import { publicServiceRequestRoutes } from "./service-request.routes";
import { publicNotificationRoutes } from "./notification.routes";

const router = Router();

// Deliberately no `authenticate` here — every route mounted on this router
// is public and unauthenticated by design: the customer-facing restaurant
// website (PRD §3.13), and Meta's WhatsApp webhook (Meta calls it
// directly, with no session of ours to attach). Mounted at `/api/public` in
// `app.ts`, entirely separate from the authenticated `/api` router tree,
// so there's no risk of an admin-only route accidentally landing here
// un-guarded.
//
// Rate limited (PRD §7 "Rate limiting ... on public ... endpoints") since
// real anonymous traffic, not just staff behind a login wall, can hit
// this — see `middleware/rate-limit.ts` `publicRateLimiter` for why this
// uses a more generous limit than the login endpoints. The webhook route
// additionally verifies Meta's own request signature
// (`middleware/verify-meta-signature.ts`) — that, not this rate limiter, is
// its real security boundary.
router.use("/dining", publicDiningRoutes);
router.use("/dining", publicServiceRequestRoutes);
router.use("/dining", publicNotificationRoutes);
router.use(publicRateLimiter);

router.get(
  "/:restaurantSlug/website",
  validate(restaurantSlugParamsSchema, "params"),
  publicWebsiteController.getPublicWebsite,
);

router.use("/whatsapp/webhook", whatsappWebhookRoutes);

export default router;
