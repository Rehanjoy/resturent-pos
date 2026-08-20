import { z } from "zod";

export const audienceSelectorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({
    type: z.literal("tags"),
    tags: z.array(z.string().trim().min(1)).min(1, "Select at least one tag."),
  }),
  z.object({
    type: z.literal("contactIds"),
    contactIds: z.array(z.string().trim().min(1)).min(1, "Select at least one contact."),
  }),
]);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required.").max(120),
  templateId: z.string().trim().min(1, "Template is required."),
  audience: audienceSelectorSchema,
  // Values for the template body's {{1}}, {{2}}, ... placeholders, in
  // order — the exact count is validated against the template's own
  // `variableCount` in `marketing-campaign.service.ts`, not here (this
  // schema doesn't know which template was picked).
  bodyParams: z.array(z.string().trim().max(500)).max(10).optional(),
});

export const campaignIdParamsSchema = z.object({
  id: z.string().min(1, "Campaign id is required."),
});

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
