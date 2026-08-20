import { Schema, model, type Types } from "mongoose";

export const DEFAULT_MAX_AUTO_REPLIES_PER_CONVERSATION = 5;

export interface AiConfigDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  /** Gemini API key, AES-256-GCM encrypted (`utils/encryption.ts`) — same
   * secrets-at-rest pattern as `WhatsappConfig.accessTokenEncrypted`,
   * `select: false` so it never comes back on a normal `find`/`findOne`.
   * Only `ai-config.service.ts` opts into it explicitly, and only to
   * decrypt for an outbound Gemini API call
   * (`whatsapp-webhook.service.ts`) or to compute a "is a key saved"
   * boolean for the Setup screen — never to return the plaintext or
   * ciphertext in an API response. */
  geminiApiKeyEncrypted?: string;
  /** Free-text the Owner can add on top of the auto-generated restaurant/
   * menu context — e.g. "we're closed on Mondays", "mention our new
   * biryani". Appended to, never replacing, the generated context
   * (`ai-config.service.ts` `buildRestaurantContext`). */
  systemPromptExtra?: string;
  /** Must be explicitly turned on — a restaurant connecting WhatsApp for
   * campaigns/Inbox does not opt them into AI auto-replies by default. */
  autoReplyEnabled: boolean;
  /** Per-conversation cap on consecutive AI auto-replies before the bot
   * must hand off to a human, even if it never flagged `handoffToHuman`
   * itself — mirrors the "per-conversation cap" pattern documented in the
   * wacrm reference this Marketing module's WhatsApp integration is based
   * on (see `lib/whatsapp/meta-api.ts`'s header comment). Resets to 0 on
   * hand-back-to-bot (`conversation.service.ts`). */
  maxAutoRepliesPerConversation: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One AI auto-reply configuration per restaurant (Marketing module Part 3
 * — `restaurantId` is `unique`, same one-config-per-restaurant shape as
 * `WhatsappConfig`). Read by `whatsapp-webhook.service.ts` on every inbound
 * message to decide whether the bot may reply at all, and by
 * `lib/ai/gemini.ts`'s caller to build the system prompt.
 */
const aiConfigSchema = new Schema<AiConfigDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
    },
    geminiApiKeyEncrypted: { type: String, select: false },
    systemPromptExtra: { type: String, trim: true, maxlength: 2000 },
    autoReplyEnabled: { type: Boolean, required: true, default: false },
    maxAutoRepliesPerConversation: {
      type: Number,
      required: true,
      default: DEFAULT_MAX_AUTO_REPLIES_PER_CONVERSATION,
      min: 1,
      max: 50,
    },
  },
  { timestamps: true },
);

export const AiConfig = model<AiConfigDocument>("AiConfig", aiConfigSchema);
