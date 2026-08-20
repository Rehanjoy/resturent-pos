import { z } from "zod";

export const saveWhatsappConfigSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Phone Number ID is required.").max(64),
  // Meta permanent access tokens are long opaque strings; no stricter shape
  // check than length — Meta's own API is the real validator, called by
  // `whatsapp-config.service.ts` `saveWhatsappConfig` before anything is
  // persisted.
  accessToken: z.string().trim().min(20, "Enter the Meta WhatsApp access token.").max(4000),
  wabaId: z.string().trim().max(64).optional().or(z.literal("")),
});
