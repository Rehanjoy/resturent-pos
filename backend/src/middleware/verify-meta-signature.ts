import { createHmac, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header on inbound WhatsApp webhook
 * POSTs (`whatsapp-webhook.routes.ts`) — the actual security boundary for
 * that endpoint, since it's public/unauthenticated by design (Meta has no
 * session of ours to send an `Authorization` header with). Meta signs the
 * exact raw JSON body with HMAC-SHA256 keyed on `META_APP_SECRET`; this
 * recomputes the same signature over `req.rawBody` (captured by
 * `app.ts`'s `express.json({ verify })`) and rejects with 401 on any
 * mismatch — missing header, wrong secret, or a tampered/re-encoded body.
 *
 * `timingSafeEqual` (not `===`) so a byte-by-byte signature comparison
 * can't leak timing information about how much of the signature matched.
 */
export function verifyMetaWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const signatureHeader = req.header("x-hub-signature-256");
  const rawBody = (req as RequestWithRawBody).rawBody;

  if (!signatureHeader || !rawBody) {
    res.status(401).json({
      success: false,
      message: "Missing webhook signature.",
      code: "INVALID_SIGNATURE",
    });
    return;
  }

  const expectedSignature = `sha256=${createHmac("sha256", env.metaAppSecret).update(rawBody).digest("hex")}`;
  const providedBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSignature);

  const isValid =
    providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);

  if (!isValid) {
    res.status(401).json({
      success: false,
      message: "Invalid webhook signature.",
      code: "INVALID_SIGNATURE",
    });
    return;
  }

  next();
}
