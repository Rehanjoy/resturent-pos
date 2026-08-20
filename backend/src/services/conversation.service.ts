import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { decrypt } from "../utils/encryption";
import { sendTextMessage } from "../lib/whatsapp/meta-api";
import { WhatsappConfig } from "../models/whatsapp-config.model";
import { Contact } from "../models/contact.model";
import {
  Conversation,
  type ConversationDocument,
  type ConversationStatus,
} from "../models/conversation.model";
import {
  WhatsappMessageLog,
  type WhatsappMessageLogDocument,
  type MessageLogSenderType,
} from "../models/whatsapp-message-log.model";

export interface ConversationDto {
  id: string;
  restaurantId: string;
  contactId: string;
  /** The contact's saved name — falls back to `phone` if the contact record
   * was somehow deleted after the conversation was created (never expected
   * in normal use, but the Inbox list must always have something to
   * display). Not stored on `Conversation` itself (that would drift if the
   * contact is later renamed); looked up fresh on every read instead. */
  contactName: string;
  phone: string;
  status: ConversationStatus;
  assignedStaffId?: string;
  aiReplyCount: number;
  lastMessageAt: Date;
  lastMessagePreview: string;
  createdAt: Date;
  updatedAt: Date;
}

function toConversationDto(
  doc: HydratedDocument<ConversationDocument>,
  contactName: string,
): ConversationDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    contactId: doc.contactId.toString(),
    contactName,
    phone: doc.phone,
    status: doc.status,
    assignedStaffId: doc.assignedStaffId?.toString(),
    aiReplyCount: doc.aiReplyCount,
    lastMessageAt: doc.lastMessageAt,
    lastMessagePreview: doc.lastMessagePreview,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Batch-resolves contact names for a page of conversations in one query
 * instead of N — the Inbox list's usual "list screen" access pattern. */
async function resolveContactNames(
  restaurantId: string,
  contactIds: Types.ObjectId[],
): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const contacts = await Contact.find({ restaurantId, _id: { $in: contactIds } }).select("name");
  return new Map(contacts.map((contact) => [contact._id.toString(), contact.name]));
}

/** Single-conversation variant of `resolveContactNames`, for the detail/
 * reply/close/hand-back-to-bot endpoints that only ever have one
 * conversation in hand. */
async function toConversationDtoWithContact(
  doc: HydratedDocument<ConversationDocument>,
): Promise<ConversationDto> {
  const contact = await Contact.findOne({ restaurantId: doc.restaurantId, _id: doc.contactId }).select("name");
  return toConversationDto(doc, contact?.name ?? doc.phone);
}

export interface ConversationMessageDto {
  id: string;
  direction: "outbound" | "inbound";
  senderType?: MessageLogSenderType;
  messageText?: string;
  status: string;
  createdAt: Date;
}

function toMessageDto(doc: HydratedDocument<WhatsappMessageLogDocument>): ConversationMessageDto {
  return {
    id: doc._id.toString(),
    direction: doc.direction,
    senderType: doc.senderType,
    messageText: doc.messageText,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export interface ListConversationsFilters {
  status?: ConversationStatus;
  page?: number;
  limit?: number;
}

export async function listConversations(
  restaurantId: string,
  filters: ListConversationsFilters = {},
): Promise<{ conversations: ConversationDto[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { restaurantId };
  if (filters.status) query.status = filters.status;

  const [conversations, total] = await Promise.all([
    Conversation.find(query).sort({ lastMessageAt: -1 }).skip(skip).limit(limit),
    Conversation.countDocuments(query),
  ]);

  const namesByContactId = await resolveContactNames(
    restaurantId,
    conversations.map((conversation) => conversation.contactId),
  );

  return {
    conversations: conversations.map((conversation) =>
      toConversationDto(
        conversation,
        namesByContactId.get(conversation.contactId.toString()) ?? conversation.phone,
      ),
    ),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findConversationOrThrow(
  restaurantId: string,
  conversationId: string,
): Promise<HydratedDocument<ConversationDocument>> {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Conversation not found.", 404, "NOT_FOUND");
  }
  const conversation = await Conversation.findOne({ _id: conversationId, restaurantId });
  if (!conversation) {
    throw new AppError("Conversation not found.", 404, "NOT_FOUND");
  }
  return conversation;
}

export async function getConversation(
  restaurantId: string,
  conversationId: string,
): Promise<{ conversation: ConversationDto; messages: ConversationMessageDto[] }> {
  const conversation = await findConversationOrThrow(restaurantId, conversationId);

  const messages = await WhatsappMessageLog.find({
    restaurantId,
    conversationId: conversation._id,
  }).sort({ createdAt: 1 });

  return {
    conversation: await toConversationDtoWithContact(conversation),
    messages: messages.map(toMessageDto),
  };
}

const PREVIEW_MAX_LENGTH = 200;

function truncatePreview(text: string): string {
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
}

/**
 * Staff sends a manual reply from the Inbox. Requires WhatsApp to be
 * connected (same precondition as a campaign send) and always uses
 * `sendTextMessage` (free-form) rather than a template — a manual Inbox
 * reply is only ever sent inside a conversation the customer just
 * messaged into, so Meta's 24-hour free-form window is open by
 * construction. Claims the conversation for the replying staff member if
 * no one has claimed it yet, and always moves `status` to
 * `"human_active"` — a human just spoke, so the bot must not also reply to
 * the same inbound message.
 */
export async function replyToConversation(
  restaurantId: string,
  staffId: string,
  conversationId: string,
  text: string,
): Promise<ConversationDto> {
  const conversation = await findConversationOrThrow(restaurantId, conversationId);

  const config = await WhatsappConfig.findOne({ restaurantId }).select("+accessTokenEncrypted");
  if (!config || !config.isConnected) {
    throw new AppError(
      "Connect your WhatsApp Business number in Setup before replying.",
      400,
      "WHATSAPP_NOT_CONNECTED",
    );
  }
  const accessToken = decrypt(config.accessTokenEncrypted);

  const now = new Date();
  try {
    const result = await sendTextMessage({
      phoneNumberId: config.phoneNumberId,
      accessToken,
      to: conversation.phone,
      text,
    });

    await WhatsappMessageLog.create({
      restaurantId,
      conversationId: conversation._id,
      contactId: conversation.contactId,
      phone: conversation.phone,
      direction: "outbound",
      senderType: "staff",
      metaMessageId: result.messageId,
      status: "sent",
      messageText: text,
      statusUpdatedAt: now,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Unknown send failure.";
    await WhatsappMessageLog.create({
      restaurantId,
      conversationId: conversation._id,
      contactId: conversation.contactId,
      phone: conversation.phone,
      direction: "outbound",
      senderType: "staff",
      status: "failed",
      failureReason,
      messageText: text,
      statusUpdatedAt: now,
    });
    throw new AppError(`Could not send the reply: ${failureReason}`, 502, "WHATSAPP_SEND_FAILED");
  }

  conversation.status = "human_active";
  if (!conversation.assignedStaffId) conversation.assignedStaffId = new Types.ObjectId(staffId);
  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = truncatePreview(text);
  await conversation.save();

  return toConversationDtoWithContact(conversation);
}

export async function closeConversation(
  restaurantId: string,
  conversationId: string,
): Promise<ConversationDto> {
  const conversation = await findConversationOrThrow(restaurantId, conversationId);
  conversation.status = "closed";
  await conversation.save();
  return toConversationDtoWithContact(conversation);
}

/** Hands the conversation back to the bot with a fresh reply cap — used
 * after a staff member has resolved whatever needed a human (or just
 * wants the bot to try again), per the build brief's "a fresh cap for the
 * next round" instruction. */
export async function handBackToBot(
  restaurantId: string,
  conversationId: string,
): Promise<ConversationDto> {
  const conversation = await findConversationOrThrow(restaurantId, conversationId);
  conversation.status = "bot_active";
  conversation.aiReplyCount = 0;
  await conversation.save();
  return toConversationDtoWithContact(conversation);
}
