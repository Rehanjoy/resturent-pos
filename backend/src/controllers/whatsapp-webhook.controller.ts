import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { env } from "../config/env";
import * as whatsappWebhookService from "../services/whatsapp-webhook.service";

/**
 * Meta's one-time webhook verification handshake, performed when you
 * register/change the webhook URL in Meta App Dashboard. Meta calls this
 * with `hub.mode=subscribe`, `hub.verify_token` (a value *we* chose —
 * `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — and pasted into Meta's config, not a
 * secret Meta gives us), and `hub.challenge`. Echoing `hub.challenge` back
 * verbatim on a token match proves to Meta this URL is really ours; any
 * mismatch (wrong/missing token, wrong mode) is a 403.
 */
export const verifyWebhook = asyncHandler(async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsappWebhookVerifyToken && typeof challenge === "string") {
    res.status(200).send(challenge);
    return;
  }

  res.status(403).json({
    success: false,
    message: "Webhook verification failed.",
    code: "WEBHOOK_VERIFICATION_FAILED",
  });
});

/** Every subsequent webhook event delivery — reached only after
 * `verifyMetaWebhookSignature` (see `routes/whatsapp-webhook.routes.ts`)
 * has already confirmed the request really came from Meta. */
export const receiveWebhookEvent = asyncHandler(async (req: Request, res: Response) => {
  await whatsappWebhookService.processWebhookEvent(req.body);
  res.status(200).json({ success: true });
});
