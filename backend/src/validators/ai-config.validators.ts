import { z } from "zod";

export const saveAiConfigSchema = z.object({
  // Optional — omitted/empty means "leave the previously saved key as-is",
  // see `ai-config.service.ts` `SaveAiConfigInput`'s own doc comment.
  geminiApiKey: z.string().trim().min(10, "Enter a valid Gemini API key.").max(500).optional().or(z.literal("")),
  systemPromptExtra: z.string().trim().max(2000).optional().or(z.literal("")),
  autoReplyEnabled: z.boolean().optional(),
  maxAutoRepliesPerConversation: z.coerce.number().int().min(1).max(50).optional(),
});
