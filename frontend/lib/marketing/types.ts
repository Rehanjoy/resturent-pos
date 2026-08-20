/** Mirrors `backend/src/services/whatsapp-config.service.ts`
 * `WhatsappConfigDto` — never carries the access token itself, encrypted
 * or otherwise (see the service's own doc comment on why). */
export interface WhatsappConfig {
  id: string;
  restaurantId: string;
  phoneNumberId: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isConnected: boolean;
  connectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactSource = "manual" | "csv_import" | "reservation" | "order";

/** Mirrors `backend/src/services/contact.service.ts` `ContactDto`. */
export interface Contact {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source: ContactSource;
  optedIn: boolean;
  notes?: string;
  createdByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactImportRejection {
  row: number;
  reason: string;
}

/** Mirrors `backend/src/services/contact.service.ts` `ImportContactsResult`
 * — the per-row summary the Contacts screen shows after a CSV upload. */
export interface ContactImportResult {
  imported: number;
  updated: number;
  rejected: ContactImportRejection[];
}

// ---------------------------------------------------------------------
// Part 2: Templates + Campaigns
// ---------------------------------------------------------------------

export type MessageTemplateCategory = "marketing" | "utility" | "authentication";
export type MessageTemplateStatus = "approved" | "pending" | "rejected";

/** Mirrors `backend/src/services/message-template.service.ts`
 * `MessageTemplateDto`. */
export interface MessageTemplate {
  id: string;
  restaurantId: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: MessageTemplateCategory;
  bodyText: string;
  status: MessageTemplateStatus;
  variableCount: number;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = "draft" | "sending" | "completed" | "failed";

/** Mirrors `backend/src/services/marketing-campaign.service.ts`
 * `MarketingCampaignDto`. */
export interface MarketingCampaign {
  id: string;
  restaurantId: string;
  name: string;
  templateId: string;
  audienceDescription: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  status: CampaignStatus;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type MessageLogStatus = "sent" | "delivered" | "read" | "failed";

/** Mirrors `backend/src/services/marketing-campaign.service.ts`
 * `CampaignRecipientDto`. */
export interface CampaignRecipient {
  id: string;
  contactId: string;
  phone: string;
  status: MessageLogStatus;
  failureReason?: string;
  createdAt: string;
  statusUpdatedAt: string;
}

/** Mirrors `backend/src/validators/marketing-campaign.validators.ts`
 * `audienceSelectorSchema`. */
export type AudienceSelector =
  | { type: "all" }
  | { type: "tags"; tags: string[] }
  | { type: "contactIds"; contactIds: string[] };

// ---------------------------------------------------------------------
// Part 3: AI Auto-Reply Inbox
// ---------------------------------------------------------------------

/** Mirrors `backend/src/services/ai-config.service.ts` `AiConfigDto` —
 * never carries the Gemini key itself, encrypted or otherwise (same
 * never-return-the-secret convention as `WhatsappConfig`). */
export interface AiConfig {
  id: string;
  restaurantId: string;
  hasGeminiApiKey: boolean;
  systemPromptExtra?: string;
  autoReplyEnabled: boolean;
  maxAutoRepliesPerConversation: number;
  createdAt: string;
  updatedAt: string;
}

export type ConversationStatus = "bot_active" | "needs_human" | "human_active" | "closed";

/** Mirrors `backend/src/services/conversation.service.ts`
 * `ConversationDto`. */
export interface Conversation {
  id: string;
  restaurantId: string;
  contactId: string;
  contactName: string;
  phone: string;
  status: ConversationStatus;
  assignedStaffId?: string;
  aiReplyCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationMessageSenderType = "customer" | "bot" | "staff";

/** Mirrors `backend/src/services/conversation.service.ts`
 * `ConversationMessageDto`. */
export interface ConversationMessage {
  id: string;
  direction: "outbound" | "inbound";
  senderType?: ConversationMessageSenderType;
  messageText?: string;
  status: string;
  createdAt: string;
}

/** Payload shape of the `whatsapp:message-received` / `whatsapp:handoff-needed`
 * Socket.io events (`backend/src/services/whatsapp-webhook.service.ts`). */
export interface ConversationLiveEvent {
  conversationId: string;
  contactId: string;
  phone: string;
  status?: ConversationStatus;
  lastMessagePreview: string;
  lastMessageAt: string;
  reason?: string;
}
