import { z } from "zod";
import { CONVERSATION_STATUSES } from "../models/conversation.model";

export const conversationIdParamsSchema = z.object({
  id: z.string().min(1, "Conversation id is required."),
});

export const listConversationsQuerySchema = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const replyToConversationSchema = z.object({
  text: z.string().trim().min(1, "Message is required.").max(4096),
});
