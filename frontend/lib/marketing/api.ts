import { api } from "@/lib/api";
import type {
  AiConfig,
  AudienceSelector,
  CampaignRecipient,
  Contact,
  ContactImportResult,
  Conversation,
  ConversationMessage,
  ConversationStatus,
  MarketingCampaign,
  MessageTemplate,
  WhatsappConfig,
} from "./types";

export interface SaveWhatsappConfigInput {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export type UpdateContactInput = Partial<CreateContactInput> & { optedIn?: boolean };

export interface ListCampaignsParams {
  page?: number;
  limit?: number;
}

export interface CreateCampaignInput {
  name: string;
  templateId: string;
  audience: AudienceSelector;
  bodyParams?: string[];
}

export interface SaveAiConfigInput {
  /** Omitted/empty = leave the previously saved key untouched — see
   * `ai-config.service.ts` `SaveAiConfigInput`'s own doc comment. */
  geminiApiKey?: string;
  systemPromptExtra?: string;
  autoReplyEnabled?: boolean;
  maxAutoRepliesPerConversation?: number;
}

export interface ListConversationsParams {
  status?: ConversationStatus;
  page?: number;
  limit?: number;
}

function buildQuery(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Marketing module admin API — WhatsApp connection config + Contacts (Part
 * 1), Templates + Campaigns (Part 2), AI Config + the AI auto-reply Inbox's
 * Conversations (Part 3 — this pass), all under this same `/api/marketing`
 * prefix. Goes through the shared `lib/api.ts` client like every other
 * admin screen.
 */
export const marketingApi = {
  getWhatsappConfig: () =>
    api.get<{ config: WhatsappConfig | null }>("/api/marketing/whatsapp-config"),

  saveWhatsappConfig: (input: SaveWhatsappConfigInput) =>
    api.patch<{ config: WhatsappConfig }>("/api/marketing/whatsapp-config", input),

  listContacts: (params: ListContactsParams = {}) =>
    api.get<{ contacts: Contact[]; total: number; page: number; totalPages: number }>(
      `/api/marketing/contacts${buildQuery(params)}`,
    ),

  createContact: (input: CreateContactInput) =>
    api.post<{ contact: Contact }>("/api/marketing/contacts", input),

  updateContact: (id: string, input: UpdateContactInput) =>
    api.patch<{ contact: Contact }>(`/api/marketing/contacts/${id}`, input),

  deleteContact: (id: string) =>
    api.delete<{ message: string }>(`/api/marketing/contacts/${id}`),

  importContacts: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.postForm<ContactImportResult>("/api/marketing/contacts/import", formData);
  },

  listMessageTemplates: () =>
    api.get<{ templates: MessageTemplate[] }>("/api/marketing/templates"),

  syncMessageTemplates: () =>
    api.post<{ total: number; created: number; updated: number }>("/api/marketing/templates/sync"),

  listCampaigns: (params: ListCampaignsParams = {}) =>
    api.get<{ campaigns: MarketingCampaign[]; total: number; page: number; totalPages: number }>(
      `/api/marketing/campaigns${buildQuery(params)}`,
    ),

  createCampaign: (input: CreateCampaignInput) =>
    api.post<{ campaign: MarketingCampaign }>("/api/marketing/campaigns", input),

  getCampaign: (id: string) =>
    api.get<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${id}`),

  listCampaignRecipients: (id: string, params: ListCampaignsParams = {}) =>
    api.get<{ recipients: CampaignRecipient[]; total: number; page: number; totalPages: number }>(
      `/api/marketing/campaigns/${id}/recipients${buildQuery(params)}`,
    ),

  getAiConfig: () => api.get<{ config: AiConfig | null }>("/api/marketing/ai-config"),

  saveAiConfig: (input: SaveAiConfigInput) =>
    api.patch<{ config: AiConfig }>("/api/marketing/ai-config", input),

  listConversations: (params: ListConversationsParams = {}) =>
    api.get<{ conversations: Conversation[]; total: number; page: number; totalPages: number }>(
      `/api/marketing/conversations${buildQuery(params)}`,
    ),

  getConversation: (id: string) =>
    api.get<{ conversation: Conversation; messages: ConversationMessage[] }>(
      `/api/marketing/conversations/${id}`,
    ),

  replyToConversation: (id: string, text: string) =>
    api.post<{ conversation: Conversation }>(`/api/marketing/conversations/${id}/reply`, { text }),

  closeConversation: (id: string) =>
    api.patch<{ conversation: Conversation }>(`/api/marketing/conversations/${id}/close`),

  handBackToBot: (id: string) =>
    api.patch<{ conversation: Conversation }>(`/api/marketing/conversations/${id}/hand-back-to-bot`),
};
