import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { decrypt } from "../utils/encryption";
import { delay } from "../utils/delay";
import { sendTemplateMessage } from "../lib/whatsapp/meta-api";
import { Contact, type ContactDocument } from "../models/contact.model";
import { WhatsappConfig } from "../models/whatsapp-config.model";
import { findApprovedTemplateOrThrow } from "./message-template.service";
import type { MessageTemplateDocument } from "../models/message-template.model";
import {
  MarketingCampaign,
  type CampaignStatus,
  type MarketingCampaignDocument,
} from "../models/marketing-campaign.model";
import {
  WhatsappMessageLog,
  type MessageLogStatus,
  type WhatsappMessageLogDocument,
} from "../models/whatsapp-message-log.model";

export interface MarketingCampaignDto {
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
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

function toCampaignDto(doc: HydratedDocument<MarketingCampaignDocument>): MarketingCampaignDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    name: doc.name,
    templateId: doc.templateId.toString(),
    audienceDescription: doc.audienceDescription,
    recipientCount: doc.recipientCount,
    sentCount: doc.sentCount,
    deliveredCount: doc.deliveredCount,
    readCount: doc.readCount,
    failedCount: doc.failedCount,
    status: doc.status,
    createdByStaffId: doc.createdByStaffId.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
  };
}

export interface CampaignRecipientDto {
  id: string;
  contactId: string;
  phone: string;
  status: MessageLogStatus;
  failureReason?: string;
  createdAt: Date;
  statusUpdatedAt: Date;
}

function toRecipientDto(doc: HydratedDocument<WhatsappMessageLogDocument>): CampaignRecipientDto {
  return {
    id: doc._id.toString(),
    contactId: doc.contactId.toString(),
    phone: doc.phone,
    status: doc.status,
    failureReason: doc.failureReason,
    createdAt: doc.createdAt,
    statusUpdatedAt: doc.statusUpdatedAt,
  };
}

export type AudienceSelector =
  | { type: "all" }
  | { type: "tags"; tags: string[] }
  | { type: "contactIds"; contactIds: string[] };

interface ResolvedAudience {
  contacts: HydratedDocument<ContactDocument>[];
  audienceDescription: string;
}

/**
 * Resolves an audience selector down to the real, opted-in recipient list.
 * `optedIn: false` contacts are always silently excluded here — never an
 * error — so `audienceDescription`/`recipientCount` on the created campaign
 * always reflect exactly who was actually messaged, not who the admin's
 * selector loosely matched.
 */
async function resolveAudience(
  restaurantId: string,
  selector: AudienceSelector,
): Promise<ResolvedAudience> {
  if (selector.type === "all") {
    const contacts = await Contact.find({ restaurantId, optedIn: true });
    return { contacts, audienceDescription: "All contacts" };
  }

  if (selector.type === "tags") {
    const contacts = await Contact.find({
      restaurantId,
      optedIn: true,
      tags: { $in: selector.tags },
    });
    return { contacts, audienceDescription: `Tag: ${selector.tags.join(", ")}` };
  }

  // selector.type === "contactIds"
  const validIds = selector.contactIds.filter((id) => Types.ObjectId.isValid(id));
  const contacts = await Contact.find({
    restaurantId,
    _id: { $in: validIds },
    optedIn: true,
  });
  return { contacts, audienceDescription: `${contacts.length} contacts (manually selected)` };
}

// Meta rate-limits the messages API; firing an entire audience's worth of
// sends at once risks tripping it on anything but a tiny restaurant contact
// list. Same "many small operations, paced in chunks" concern as
// `inventory-deduction.service.ts`'s per-item ledger loop, just applied to
// an outbound HTTP call instead of a DB write: send up to
// `SEND_BATCH_SIZE` templates concurrently, then pause `SEND_BATCH_DELAY_MS`
// before the next batch. At restaurant-realistic scale (dozens to low
// hundreds of contacts, per this module's build brief) a full campaign
// finishes in well under the length of a single HTTP request timeout. A
// restaurant with a genuinely large list (thousands of contacts) would
// need this moved to a background job queue — this codebase doesn't have
// one yet (see docs/01-product-brief.md's "not yet built" list), so
// synchronous-in-request is the documented, intentional MVP tradeoff here.
const SEND_BATCH_SIZE = 20;
const SEND_BATCH_DELAY_MS = 1000;

interface SendCampaignArgs {
  restaurantId: string;
  campaignId: Types.ObjectId;
  template: HydratedDocument<MessageTemplateDocument>;
  phoneNumberId: string;
  accessToken: string;
  bodyParams: string[];
  contacts: HydratedDocument<ContactDocument>[];
}

async function sendToOneContact(args: {
  restaurantId: string;
  campaignId: Types.ObjectId;
  template: HydratedDocument<MessageTemplateDocument>;
  phoneNumberId: string;
  accessToken: string;
  bodyParams: string[];
  contact: HydratedDocument<ContactDocument>;
}): Promise<void> {
  const { restaurantId, campaignId, template, phoneNumberId, accessToken, bodyParams, contact } = args;
  const now = new Date();

  try {
    const result = await sendTemplateMessage({
      phoneNumberId,
      accessToken,
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
      bodyParams,
    });

    await WhatsappMessageLog.create({
      restaurantId,
      campaignId,
      contactId: contact._id,
      phone: contact.phone,
      direction: "outbound",
      metaMessageId: result.messageId,
      status: "sent",
      statusUpdatedAt: now,
    });
    await MarketingCampaign.updateOne({ _id: campaignId }, { $inc: { sentCount: 1 } });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Unknown send failure.";
    await WhatsappMessageLog.create({
      restaurantId,
      campaignId,
      contactId: contact._id,
      phone: contact.phone,
      direction: "outbound",
      status: "failed",
      failureReason,
      statusUpdatedAt: now,
    });
    await MarketingCampaign.updateOne({ _id: campaignId }, { $inc: { failedCount: 1 } });
  }
}

/**
 * Sends the campaign's template to every resolved recipient, in paced
 * batches (see `SEND_BATCH_SIZE`/`SEND_BATCH_DELAY_MS` above), logging every
 * attempt to `WhatsappMessageLog` and updating the campaign's running
 * counters via atomic `$inc` (safe under the within-batch concurrency this
 * function creates — same atomic-per-document-update reasoning as
 * `inventory-deduction.service.ts`, not a multi-document transaction,
 * because each log row is independently meaningful). Marks the campaign
 * `"completed"` once every batch has been attempted, or `"failed"` if the
 * loop itself throws (a DB/network problem unrelated to any single
 * recipient) rather than leaving it stuck on `"sending"` forever.
 */
async function sendCampaignToAudience(args: SendCampaignArgs): Promise<void> {
  const { restaurantId, campaignId, template, phoneNumberId, accessToken, bodyParams, contacts } = args;

  try {
    for (let start = 0; start < contacts.length; start += SEND_BATCH_SIZE) {
      const batch = contacts.slice(start, start + SEND_BATCH_SIZE);

      await Promise.all(
        batch.map((contact) =>
          sendToOneContact({
            restaurantId,
            campaignId,
            template,
            phoneNumberId,
            accessToken,
            bodyParams,
            contact,
          }),
        ),
      );

      const isLastBatch = start + SEND_BATCH_SIZE >= contacts.length;
      if (!isLastBatch) await delay(SEND_BATCH_DELAY_MS);
    }

    await MarketingCampaign.updateOne(
      { _id: campaignId },
      { $set: { status: "completed", completedAt: new Date() } },
    );
  } catch (error) {
    console.error(
      `[marketing] Campaign ${campaignId.toString()} (restaurant ${restaurantId}) did not finish sending`,
      error,
    );
    await MarketingCampaign.updateOne(
      { _id: campaignId },
      { $set: { status: "failed", completedAt: new Date() } },
    );
  }
}

export interface CreateCampaignInput {
  name: string;
  templateId: string;
  audience: AudienceSelector;
  bodyParams?: string[];
}

/**
 * Creates a campaign and sends it end to end within this one request (see
 * `sendCampaignToAudience`'s doc comment for the scale/tradeoff reasoning).
 * Validates the template is approved and that the caller supplied exactly
 * as many body values as the template's `{{n}}` placeholders need, before
 * touching Meta or resolving the audience.
 */
export async function createCampaign(
  restaurantId: string,
  staffId: string,
  input: CreateCampaignInput,
): Promise<MarketingCampaignDto> {
  const template = await findApprovedTemplateOrThrow(restaurantId, input.templateId);

  const bodyParams = input.bodyParams ?? [];
  if (bodyParams.length !== template.variableCount) {
    throw new AppError(
      `This template needs ${template.variableCount} value(s) — received ${bodyParams.length}.`,
      400,
      "TEMPLATE_PARAM_COUNT_MISMATCH",
    );
  }

  const config = await WhatsappConfig.findOne({ restaurantId }).select("+accessTokenEncrypted");
  if (!config || !config.isConnected) {
    throw new AppError(
      "Connect your WhatsApp Business number in Setup before sending a campaign.",
      400,
      "WHATSAPP_NOT_CONNECTED",
    );
  }
  const accessToken = decrypt(config.accessTokenEncrypted);

  const { contacts, audienceDescription } = await resolveAudience(restaurantId, input.audience);

  const campaign = await MarketingCampaign.create({
    restaurantId,
    name: input.name,
    templateId: template._id,
    audienceDescription,
    recipientCount: contacts.length,
    status: "sending",
    createdByStaffId: staffId,
  });

  // Zero eligible recipients (e.g. every matched contact is opted out) is
  // not an error — `sendCampaignToAudience`'s batch loop is a no-op on an
  // empty array and falls straight through to marking the campaign
  // "completed", same as any other campaign that finishes sending.
  await sendCampaignToAudience({
    restaurantId,
    campaignId: campaign._id,
    template,
    phoneNumberId: config.phoneNumberId,
    accessToken,
    bodyParams,
    contacts,
  });

  const completed = await MarketingCampaign.findById(campaign._id);
  return toCampaignDto(completed as HydratedDocument<MarketingCampaignDocument>);
}

export interface ListCampaignsFilters {
  page?: number;
  limit?: number;
}

export async function listCampaigns(
  restaurantId: string,
  filters: ListCampaignsFilters = {},
): Promise<{ campaigns: MarketingCampaignDto[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    MarketingCampaign.find({ restaurantId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    MarketingCampaign.countDocuments({ restaurantId }),
  ]);

  return {
    campaigns: campaigns.map(toCampaignDto),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findCampaignOrThrow(
  restaurantId: string,
  campaignId: string,
): Promise<HydratedDocument<MarketingCampaignDocument>> {
  if (!Types.ObjectId.isValid(campaignId)) {
    throw new AppError("Campaign not found.", 404, "NOT_FOUND");
  }
  const campaign = await MarketingCampaign.findOne({ _id: campaignId, restaurantId });
  if (!campaign) {
    throw new AppError("Campaign not found.", 404, "NOT_FOUND");
  }
  return campaign;
}

export async function getCampaign(restaurantId: string, campaignId: string): Promise<MarketingCampaignDto> {
  const campaign = await findCampaignOrThrow(restaurantId, campaignId);
  return toCampaignDto(campaign);
}

export interface ListCampaignRecipientsFilters {
  page?: number;
  limit?: number;
}

export async function listCampaignRecipients(
  restaurantId: string,
  campaignId: string,
  filters: ListCampaignRecipientsFilters = {},
): Promise<{ recipients: CampaignRecipientDto[]; total: number; page: number; totalPages: number }> {
  const campaign = await findCampaignOrThrow(restaurantId, campaignId);

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    WhatsappMessageLog.find({ restaurantId, campaignId: campaign._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WhatsappMessageLog.countDocuments({ restaurantId, campaignId: campaign._id }),
  ]);

  return {
    recipients: logs.map(toRecipientDto),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
