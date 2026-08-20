import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { decrypt } from "../utils/encryption";
import { listMessageTemplates as fetchMetaMessageTemplates } from "../lib/whatsapp/meta-api";
import { WhatsappConfig } from "../models/whatsapp-config.model";
import {
  MessageTemplate,
  type MessageTemplateCategory,
  type MessageTemplateDocument,
  type MessageTemplateStatus,
} from "../models/message-template.model";

export interface MessageTemplateDto {
  id: string;
  restaurantId: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: MessageTemplateCategory;
  bodyText: string;
  status: MessageTemplateStatus;
  variableCount: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(doc: HydratedDocument<MessageTemplateDocument>): MessageTemplateDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    metaTemplateId: doc.metaTemplateId,
    name: doc.name,
    language: doc.language,
    category: doc.category,
    bodyText: doc.bodyText,
    status: doc.status,
    variableCount: doc.variableCount,
    syncedAt: doc.syncedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Meta's raw category strings ("MARKETING"/"UTILITY"/"AUTHENTICATION") ->
 * this app's lowercase enum. Anything unrecognized falls back to
 * "marketing" — Meta hasn't added a new top-level category in years, but a
 * new/renamed one should still sync as *something* rather than reject the
 * whole sync. */
function normalizeCategory(raw: string): MessageTemplateCategory {
  const upper = raw.toUpperCase();
  if (upper === "UTILITY") return "utility";
  if (upper === "AUTHENTICATION") return "authentication";
  return "marketing";
}

/** Meta's status enum is wider than this app's (APPROVED / PENDING /
 * REJECTED / PAUSED / DISABLED / IN_APPEAL / PENDING_DELETION) — this app
 * only needs to distinguish "safe to send" from "not yet" / "not ever", so
 * every non-approved, non-pending status collapses to "rejected" (a
 * disabled or paused template can't be sent either, same as a rejected
 * one). */
function normalizeStatus(raw: string): MessageTemplateStatus {
  const upper = raw.toUpperCase();
  if (upper === "APPROVED") return "approved";
  if (upper === "PENDING" || upper === "IN_APPEAL" || upper === "PENDING_DELETION") return "pending";
  return "rejected";
}

const BODY_VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

/** Meta numbers body placeholders sequentially from `{{1}}` — the highest
 * index found is the number of values a send needs to collect, which is
 * more robust than counting matches (a template could in theory reuse
 * `{{1}}` twice, and a count of matches would over-report). */
export function countBodyVariables(bodyText: string): number {
  let max = 0;
  for (const match of bodyText.matchAll(BODY_VARIABLE_PATTERN)) {
    const index = Number(match[1]);
    if (index > max) max = index;
  }
  return max;
}

export async function listMessageTemplates(restaurantId: string): Promise<MessageTemplateDto[]> {
  const templates = await MessageTemplate.find({ restaurantId }).sort({ status: 1, name: 1 });
  return templates.map(toDto);
}

export interface SyncMessageTemplatesResult {
  /** Total templates Meta returned (after this app's body-text-only
   * filter, applied in `lib/whatsapp/meta-api.ts`). */
  total: number;
  created: number;
  updated: number;
}

/**
 * Pulls the connected WABA's message templates from Meta and upserts them
 * into the local cache by `metaTemplateId` (`message-template.model.ts`).
 * Never creates/submits a template on Meta's side — this app is read-only
 * with respect to Meta's template catalog, by design (see the model's doc
 * comment).
 */
export async function syncMessageTemplates(restaurantId: string): Promise<SyncMessageTemplatesResult> {
  const config = await WhatsappConfig.findOne({ restaurantId }).select("+accessTokenEncrypted");
  if (!config || !config.isConnected) {
    throw new AppError(
      "Connect your WhatsApp Business number in Setup before syncing templates.",
      400,
      "WHATSAPP_NOT_CONNECTED",
    );
  }
  if (!config.wabaId) {
    throw new AppError(
      "WhatsApp Business Account ID is missing — reconnect your WhatsApp number with the WABA ID in Setup.",
      400,
      "WABA_ID_MISSING",
    );
  }

  const accessToken = decrypt(config.accessTokenEncrypted);

  let metaTemplates;
  try {
    metaTemplates = await fetchMetaMessageTemplates({ wabaId: config.wabaId, accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch templates from Meta.";
    throw new AppError(`Could not sync templates from WhatsApp: ${message}`, 502, "TEMPLATE_SYNC_FAILED");
  }

  const syncedAt = new Date();
  let created = 0;
  let updated = 0;

  for (const metaTemplate of metaTemplates) {
    const existed = await MessageTemplate.exists({
      restaurantId,
      metaTemplateId: metaTemplate.metaTemplateId,
    });

    await MessageTemplate.findOneAndUpdate(
      { restaurantId, metaTemplateId: metaTemplate.metaTemplateId },
      {
        $set: {
          restaurantId,
          metaTemplateId: metaTemplate.metaTemplateId,
          name: metaTemplate.name,
          language: metaTemplate.language,
          category: normalizeCategory(metaTemplate.category),
          bodyText: metaTemplate.bodyText,
          status: normalizeStatus(metaTemplate.status),
          variableCount: countBodyVariables(metaTemplate.bodyText),
          syncedAt,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (existed) updated += 1;
    else created += 1;
  }

  return { total: metaTemplates.length, created, updated };
}

export async function findApprovedTemplateOrThrow(
  restaurantId: string,
  templateId: string,
): Promise<HydratedDocument<MessageTemplateDocument>> {
  if (!Types.ObjectId.isValid(templateId)) {
    throw new AppError("Template not found.", 404, "NOT_FOUND");
  }
  const template = await MessageTemplate.findOne({ _id: templateId, restaurantId });
  if (!template) {
    throw new AppError("Template not found.", 404, "NOT_FOUND");
  }
  if (template.status !== "approved") {
    throw new AppError(
      "Only an approved template can be used in a campaign.",
      400,
      "TEMPLATE_NOT_APPROVED",
    );
  }
  return template;
}
