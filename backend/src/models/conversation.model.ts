import { Schema, model, type Types } from "mongoose";

export const CONVERSATION_STATUSES = ["bot_active", "needs_human", "human_active", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export interface ConversationDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  contactId: Types.ObjectId;
  /** Denormalized from `Contact.phone` — same "stays meaningful even if the
   * contact record changes" reasoning as `WhatsappMessageLog.phone`. */
  phone: string;
  status: ConversationStatus;
  /** Set once a staff member sends a manual reply or the conversation is
   * otherwise picked up by a human (`conversation.service.ts` `replyToConversation`).
   * Left unset while `status` is `"bot_active"`/`"needs_human"` and no one
   * has claimed it yet. */
  assignedStaffId?: Types.ObjectId;
  /** How many AI auto-replies have been sent in the current bot-handling
   * round — reset to 0 whenever a human takes over (`status` moves off
   * `"bot_active"`) or `hand-back-to-bot` restarts a fresh round. Compared
   * against `AiConfig.maxAutoRepliesPerConversation` on every inbound
   * message to decide whether the bot may reply again or must hand off. */
  aiReplyCount: number;
  lastMessageAt: Date;
  /** Short text (last message's content, truncated) for the Inbox list —
   * kept denormalized here so the list screen never needs a second query
   * per row against `WhatsappMessageLog`. */
  lastMessagePreview: string;
  createdAt: Date;
  updatedAt: Date;
}

const LAST_MESSAGE_PREVIEW_MAX_LENGTH = 200;

/**
 * One WhatsApp conversation thread per contact per restaurant (Marketing
 * module Part 3 — AI auto-reply Inbox). Created the first time a phone
 * number messages the connected WhatsApp number
 * (`whatsapp-webhook.service.ts`), and reused for every message after that
 * — a conversation is never re-created for the same contact, it just moves
 * through `status` over time (bot handling it, needing a human, a human
 * actively on it, or closed out). `WhatsappMessageLog` rows with this
 * document's `_id` as their `conversationId` are the actual message
 * history; this document is the thread's current state + Inbox-list
 * summary.
 */
const conversationSchema = new Schema<ConversationDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: true },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: CONVERSATION_STATUSES, required: true, default: "bot_active" },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: "User" },
    aiReplyCount: { type: Number, required: true, default: 0, min: 0 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    lastMessagePreview: { type: String, required: true, trim: true, maxlength: LAST_MESSAGE_PREVIEW_MAX_LENGTH },
  },
  { timestamps: true },
);

// One thread per contact — the find-or-create key on every inbound message.
conversationSchema.index({ restaurantId: 1, contactId: 1 }, { unique: true });
// Powers the Inbox list's status filter (e.g. "Needs You").
conversationSchema.index({ restaurantId: 1, status: 1 });
// Powers the Inbox list's default sort (most recently active first).
conversationSchema.index({ restaurantId: 1, lastMessageAt: -1 });

export const Conversation = model<ConversationDocument>("Conversation", conversationSchema);
