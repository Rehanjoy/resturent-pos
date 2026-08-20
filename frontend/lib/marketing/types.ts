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
