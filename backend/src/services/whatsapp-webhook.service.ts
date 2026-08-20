import type { HydratedDocument, Types } from "mongoose";
import { WhatsappConfig, type WhatsappConfigDocument } from "../models/whatsapp-config.model";
import { WhatsappMessageLog, type MessageLogStatus } from "../models/whatsapp-message-log.model";
import { MarketingCampaign } from "../models/marketing-campaign.model";
import { Contact, type ContactDocument } from "../models/contact.model";
import { Conversation, type ConversationDocument } from "../models/conversation.model";
import { AiConfig } from "../models/ai-config.model";
import { decrypt } from "../utils/encryption";
import { sendTextMessage } from "../lib/whatsapp/meta-api";
import { generateReply, type GeminiChatTurn } from "../lib/ai/gemini";
import { buildRestaurantContext } from "./ai-config.service";
import { emitToRestaurant } from "../sockets";

interface MetaWebhookStatusError {
  title?: string;
  message?: string;
}

interface MetaWebhookStatus {
  id: string;
  status: string;
  errors?: MetaWebhookStatusError[];
}

interface MetaWebhookInboundMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
}

interface MetaWebhookContactProfile {
  wa_id?: string;
  profile?: { name?: string };
}

interface MetaWebhookChangeValue {
  metadata?: { phone_number_id?: string };
  statuses?: MetaWebhookStatus[];
  messages?: MetaWebhookInboundMessage[];
  /** Parallel array to `messages` — Meta's own contact-profile metadata
   * (display name) for each sender, matched by `wa_id`. */
  contacts?: MetaWebhookContactProfile[];
}

interface MetaWebhookChange {
  field: string;
  value: MetaWebhookChangeValue;
}

interface MetaWebhookEntry {
  changes?: MetaWebhookChange[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

const STATUS_TO_CAMPAIGN_COUNTER: Partial<Record<MessageLogStatus, "deliveredCount" | "readCount" | "failedCount">> = {
  delivered: "deliveredCount",
  read: "readCount",
  failed: "failedCount",
};

function normalizeStatus(raw: string): MessageLogStatus | null {
  if (raw === "sent" || raw === "delivered" || raw === "read" || raw === "failed") return raw;
  // Meta also sends other status-field values on this endpoint (e.g.
  // "deleted", for a message removed within the delivery window) — none of
  // this app's four tracked states, so they're a documented no-op rather
  // than an error.
  return null;
}

/**
 * Applies one Meta message-status event to the matching `WhatsappMessageLog`
 * row (looked up by the compound `{restaurantId, metaMessageId}` index —
 * `restaurantId` resolved from the sending phone number, see
 * `processWebhookEvent`) and rolls the transition up into the parent
 * campaign's counters via an atomic `$inc`, same reasoning as
 * `marketing-campaign.service.ts`'s send loop: many small, independently
 * safe updates rather than one multi-document transaction.
 */
async function applyStatusUpdate(restaurantId: string, status: MetaWebhookStatus): Promise<void> {
  const normalized = normalizeStatus(status.status);
  if (!normalized) return;

  const log = await WhatsappMessageLog.findOne({ restaurantId, metaMessageId: status.id });
  if (!log) return; // Not one of ours, or the log row hasn't been written yet — nothing to update.

  log.status = normalized;
  log.statusUpdatedAt = new Date();
  if (normalized === "failed") {
    const firstError = status.errors?.[0];
    log.failureReason = firstError?.message ?? firstError?.title ?? log.failureReason;
  }
  await log.save();

  if (log.campaignId) {
    const counterField = STATUS_TO_CAMPAIGN_COUNTER[normalized];
    if (counterField) {
      await MarketingCampaign.updateOne({ _id: log.campaignId }, { $inc: { [counterField]: 1 } });
    }
  }
}

/** Meta sends `from` as digits only (no leading "+"), e.g. `"919876543210"`
 * — this app's `Contact.phone`/E.164 convention requires the "+" (see
 * `utils/phone.ts`), so every inbound sender number is normalized through
 * here before it ever reaches `Contact`/`Conversation`. */
function normalizeMetaPhone(rawFrom: string): string {
  return rawFrom.startsWith("+") ? rawFrom : `+${rawFrom}`;
}

function extractMessageText(message: MetaWebhookInboundMessage): string {
  if (message.type === "text" && message.text?.body) return message.text.body;
  // Non-text message types (image, audio, location, ...) are logged with a
  // placeholder — accepting/rendering media is out of scope for this MVP's
  // Inbox, but the message must never be silently dropped.
  return `[${message.type} message]`;
}

const PREVIEW_MAX_LENGTH = 200;
function truncatePreview(text: string): string {
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
}

async function findOrCreateContact(
  restaurantId: string,
  phone: string,
  profileName?: string,
): Promise<HydratedDocument<ContactDocument>> {
  const existing = await Contact.findOne({ restaurantId, phone });
  if (existing) return existing;

  return Contact.create({
    restaurantId,
    name: profileName?.trim() || phone,
    phone,
    source: "whatsapp",
    optedIn: true,
  });
}

async function findOrCreateConversation(
  restaurantId: string,
  contact: HydratedDocument<ContactDocument>,
  initialPreviewText: string,
): Promise<HydratedDocument<ConversationDocument>> {
  const existing = await Conversation.findOne({ restaurantId, contactId: contact._id });
  if (existing) return existing;

  return Conversation.create({
    restaurantId,
    contactId: contact._id,
    phone: contact.phone,
    status: "bot_active",
    aiReplyCount: 0,
    lastMessageAt: new Date(),
    // `lastMessagePreview` is a required field — a brand-new conversation
    // is always created *because* a first message just arrived, so that
    // message's own text is always available here as the initial preview
    // (immediately overwritten below in `processOneInboundMessage` with
    // the same value anyway, this just satisfies the schema at the moment
    // of creation).
    lastMessagePreview: truncatePreview(initialPreviewText),
  });
}

// How much prior conversation history is handed to Gemini as context — see
// `lib/ai/gemini.ts` `GenerateReplyArgs.history`'s own doc comment on why
// this is capped rather than the whole thread.
const AI_HISTORY_MESSAGE_LIMIT = 15;

async function loadRecentHistory(
  restaurantId: string,
  conversationId: Types.ObjectId,
  excludeLogId: Types.ObjectId,
): Promise<GeminiChatTurn[]> {
  const recent = await WhatsappMessageLog.find({
    restaurantId,
    conversationId,
    _id: { $ne: excludeLogId },
  })
    .sort({ createdAt: -1 })
    .limit(AI_HISTORY_MESSAGE_LIMIT);

  // `find` above is newest-first (for an efficient "last N" query) — flip
  // to oldest-first, the order `generateReply` expects a conversation
  // transcript in.
  return recent
    .reverse()
    .map((log) => ({
      role: log.direction === "inbound" ? "customer" : "assistant",
      text: log.messageText ?? "",
    }));
}

/**
 * Handles one inbound customer message end to end: find-or-create the
 * `Contact`/`Conversation`, log the inbound message, and — only when the
 * conversation is bot-eligible (`status: "bot_active"`, auto-reply on, a
 * Gemini key on file, and under the per-conversation reply cap) — generate
 * and send an AI reply. Never throws: a failure here must not stop the
 * rest of the webhook batch (`processWebhookEvent`'s caller wraps this in
 * a per-message try/catch) or crash the webhook handler.
 */
async function processOneInboundMessage(
  restaurantId: string,
  config: HydratedDocument<WhatsappConfigDocument>,
  message: MetaWebhookInboundMessage,
  contactProfiles: MetaWebhookContactProfile[],
): Promise<void> {
  const phone = normalizeMetaPhone(message.from);
  const text = extractMessageText(message);
  const profileName = contactProfiles.find((entry) => entry.wa_id === message.from)?.profile?.name;

  const contact = await findOrCreateContact(restaurantId, phone, profileName);
  const conversation = await findOrCreateConversation(restaurantId, contact, text);

  const now = new Date();
  const inboundLog = await WhatsappMessageLog.create({
    restaurantId,
    conversationId: conversation._id,
    contactId: contact._id,
    phone,
    direction: "inbound",
    senderType: "customer",
    metaMessageId: message.id,
    status: "delivered",
    messageText: text,
    statusUpdatedAt: now,
  });

  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = truncatePreview(text);

  const aiConfig = await AiConfig.findOne({ restaurantId }).select("+geminiApiKeyEncrypted");
  const botEligible =
    conversation.status === "bot_active" &&
    !!aiConfig?.autoReplyEnabled &&
    !!aiConfig?.geminiApiKeyEncrypted &&
    conversation.aiReplyCount < aiConfig.maxAutoRepliesPerConversation;

  if (!botEligible) {
    await conversation.save();
    emitToRestaurant(restaurantId, "whatsapp:message-received", {
      conversationId: conversation._id.toString(),
      contactId: contact._id.toString(),
      phone,
      status: conversation.status,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
    });
    return;
  }

  const history = await loadRecentHistory(restaurantId, conversation._id, inboundLog._id);
  const restaurantContext = await buildRestaurantContext(restaurantId, aiConfig!.systemPromptExtra);
  const apiKey = decrypt(aiConfig!.geminiApiKeyEncrypted!);

  const aiResult = await generateReply({
    apiKey,
    restaurantContext,
    history,
    inboundMessage: text,
  });

  let sendFailed = false;
  try {
    const accessToken = decrypt(config.accessTokenEncrypted);
    const sendResult = await sendTextMessage({
      phoneNumberId: config.phoneNumberId,
      accessToken,
      to: phone,
      text: aiResult.reply,
    });

    await WhatsappMessageLog.create({
      restaurantId,
      conversationId: conversation._id,
      contactId: contact._id,
      phone,
      direction: "outbound",
      senderType: "bot",
      metaMessageId: sendResult.messageId,
      status: "sent",
      messageText: aiResult.reply,
      statusUpdatedAt: new Date(),
    });
    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = truncatePreview(aiResult.reply);
  } catch (error) {
    sendFailed = true;
    const failureReason = error instanceof Error ? error.message : "Unknown send failure.";
    await WhatsappMessageLog.create({
      restaurantId,
      conversationId: conversation._id,
      contactId: contact._id,
      phone,
      direction: "outbound",
      senderType: "bot",
      status: "failed",
      failureReason,
      messageText: aiResult.reply,
      statusUpdatedAt: new Date(),
    });
  }

  conversation.aiReplyCount += 1;
  const capHit = conversation.aiReplyCount >= aiConfig!.maxAutoRepliesPerConversation;
  const handoffNeeded = aiResult.handoffToHuman || sendFailed || capHit;

  if (handoffNeeded) {
    conversation.status = "needs_human";
    await conversation.save();
    emitToRestaurant(restaurantId, "whatsapp:handoff-needed", {
      conversationId: conversation._id.toString(),
      contactId: contact._id.toString(),
      phone,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      reason: sendFailed
        ? "Could not deliver the AI reply."
        : capHit && !aiResult.handoffToHuman
          ? "Reached the maximum number of automatic replies for this conversation."
          : aiResult.handoffReason,
    });
    return;
  }

  await conversation.save();
  emitToRestaurant(restaurantId, "whatsapp:message-received", {
    conversationId: conversation._id.toString(),
    contactId: contact._id.toString(),
    phone,
    status: conversation.status,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
  });
}

/**
 * Entry point for every inbound Meta WhatsApp webhook POST
 * (`whatsapp-webhook.routes.ts`, signature-verified before this ever
 * runs). Handles both outbound message **status** updates (sent/delivered/
 * read/failed — Part 2) and inbound **customer messages** (Part 3's AI
 * auto-reply Inbox) from the same `change.value` payload.
 *
 * Never throws — Meta expects a fast 200 on every delivery regardless of
 * internal outcome; a non-2xx just triggers Meta's own retry/backoff,
 * re-delivering the exact same event into the same problem. Failures are
 * logged, not propagated — including per-message failures inside a batch
 * of several inbound messages, so one bad message never blocks the rest.
 */
export async function processWebhookEvent(payload: unknown): Promise<void> {
  try {
    const body = payload as MetaWebhookPayload;
    if (!body?.entry?.length) return;

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const phoneNumberId = change.value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const config = await WhatsappConfig.findOne({ phoneNumberId }).select("+accessTokenEncrypted");
        if (!config) continue; // Event for a phone number this app doesn't have connected (anymore).

        const restaurantId = config.restaurantId.toString();

        const statuses = change.value.statuses ?? [];
        for (const status of statuses) {
          await applyStatusUpdate(restaurantId, status);
        }

        const messages = change.value.messages ?? [];
        const contactProfiles = change.value.contacts ?? [];
        for (const message of messages) {
          try {
            await processOneInboundMessage(restaurantId, config, message, contactProfiles);
          } catch (error) {
            console.error(
              `[whatsapp-webhook] Failed to process inbound message ${message.id} (restaurant ${restaurantId})`,
              error,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[whatsapp-webhook] Failed to process an inbound webhook event", error);
  }
}
