import { WhatsappConfig } from "../models/whatsapp-config.model";
import { WhatsappMessageLog, type MessageLogStatus } from "../models/whatsapp-message-log.model";
import { MarketingCampaign } from "../models/marketing-campaign.model";

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
}

interface MetaWebhookChangeValue {
  metadata?: { phone_number_id?: string };
  statuses?: MetaWebhookStatus[];
  /** Part 3's inbox reads this — intentionally unused here. */
  messages?: MetaWebhookInboundMessage[];
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

/**
 * Entry point for every inbound Meta WhatsApp webhook POST
 * (`whatsapp-webhook.routes.ts`, signature-verified before this ever
 * runs). Handles outbound message **status** updates (sent/delivered/
 * read/failed) end to end.
 *
 * PART 3 EXTENSION POINT — `change.value.messages` (inbound customer
 * messages) is intentionally left unhandled here; the caller still
 * responds 200 either way (Meta only cares that delivery was
 * acknowledged). Part 3's AI auto-reply inbox adds its handling as a
 * sibling branch next to the `statuses` loop below, reusing this same
 * entry point rather than a second webhook route/endpoint.
 *
 * Never throws — Meta expects a fast 200 on every delivery regardless of
 * internal outcome; a non-2xx just triggers Meta's own retry/backoff,
 * re-delivering the exact same event into the same problem. Failures are
 * logged, not propagated.
 */
export async function processWebhookEvent(payload: unknown): Promise<void> {
  try {
    const body = payload as MetaWebhookPayload;
    if (!body?.entry?.length) return;

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const statuses = change.value.statuses ?? [];
        if (statuses.length === 0) continue;

        const phoneNumberId = change.value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const config = await WhatsappConfig.findOne({ phoneNumberId });
        if (!config) continue; // Event for a phone number this app doesn't have connected (anymore).

        const restaurantId = config.restaurantId.toString();
        for (const status of statuses) {
          await applyStatusUpdate(restaurantId, status);
        }

        // PART 3 EXTENSION POINT — `change.value.messages` (inbound
        // customer messages) intentionally not processed yet.
      }
    }
  } catch (error) {
    console.error("[whatsapp-webhook] Failed to process an inbound webhook event", error);
  }
}
