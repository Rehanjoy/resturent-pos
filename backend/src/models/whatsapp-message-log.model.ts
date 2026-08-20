import { Schema, model, type Types } from "mongoose";

export const MESSAGE_LOG_DIRECTIONS = ["outbound", "inbound"] as const;
export type MessageLogDirection = (typeof MESSAGE_LOG_DIRECTIONS)[number];

export const MESSAGE_LOG_STATUSES = ["sent", "delivered", "read", "failed"] as const;
export type MessageLogStatus = (typeof MESSAGE_LOG_STATUSES)[number];

export interface WhatsappMessageLogDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  /** Set when this send was part of a campaign broadcast. Left unset for
   * Part 3's AI auto-reply inbox rows (both outbound replies and inbound
   * customer messages), which log here too but aren't tied to a campaign. */
  campaignId?: Types.ObjectId;
  contactId: Types.ObjectId;
  /** Denormalized from `Contact.phone` at send time — stays meaningful even
   * if the contact is later deleted, since this row is part of an
   * append-only send/delivery audit trail. */
  phone: string;
  /** Only `"outbound"` is produced anywhere in the codebase today (Part 2's
   * campaign sends). `"inbound"` is Part 3's extension point — see
   * `whatsapp-webhook.service.ts`'s doc comment on where that gets wired
   * in, reusing this same model rather than a second one. */
  direction: MessageLogDirection;
  /** Meta's own message id (`wamid...`) — globally unique across every
   * WhatsApp Business Platform sender, which is what makes the webhook
   * lookup in `whatsapp-webhook.service.ts` `applyStatusUpdate` work.
   * Unset when the send attempt failed before Meta ever returned an id. */
  metaMessageId?: string;
  status: MessageLogStatus;
  /** Set when `status: "failed"` — either this app's own send error
   * (`sendTemplateMessage` threw) or Meta's own delivery-failure reason
   * relayed through a webhook status event. */
  failureReason?: string;
  createdAt: Date;
  /** Bumped every time `status` changes (send attempt -> Meta's
   * delivered/read/failed webhook callbacks) — lets the campaign detail
   * screen show "last updated" per recipient, distinct from `createdAt`
   * (when the send was first attempted). */
  statusUpdatedAt: Date;
}

/**
 * Append-only-in-spirit send/delivery log for every WhatsApp message this
 * app sends or (Part 3) receives — the audit trail behind a campaign's
 * `sentCount`/`deliveredCount`/`readCount`/`failedCount` rollups
 * (`marketing-campaign.model.ts`) and the "why did these fail" detail view
 * on the Campaign screen. Rows are created once per send attempt
 * (`marketing-campaign.service.ts`) and then mutated in place as Meta's
 * webhook delivers status updates (`whatsapp-webhook.service.ts`) — that
 * in-place `status`/`statusUpdatedAt` update is the one exception to this
 * codebase's usual "ledgers are append-only" convention (see
 * `inventory-transaction.model.ts`), because a message's delivery state is
 * inherently a single evolving fact about one send, not a new event each
 * time; every count derived from `status` transitions is instead recorded
 * as an atomic `$inc` on the parent campaign at the moment of transition,
 * which is the actual audit-safe number.
 */
const whatsappMessageLogSchema = new Schema<WhatsappMessageLogDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    campaignId: { type: Schema.Types.ObjectId, ref: "MarketingCampaign" },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: true },
    phone: { type: String, required: true, trim: true },
    direction: { type: String, enum: MESSAGE_LOG_DIRECTIONS, required: true },
    metaMessageId: { type: String, trim: true },
    status: { type: String, enum: MESSAGE_LOG_STATUSES, required: true },
    failureReason: { type: String, trim: true },
    statusUpdatedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Fast webhook lookup — `whatsapp-webhook.service.ts` resolves the sending
// restaurant from Meta's `metadata.phone_number_id` first, then looks a row
// up by this exact compound key.
whatsappMessageLogSchema.index({ restaurantId: 1, metaMessageId: 1 });
// Powers the campaign detail screen's recipients list.
whatsappMessageLogSchema.index({ restaurantId: 1, campaignId: 1, createdAt: -1 });

export const WhatsappMessageLog = model<WhatsappMessageLogDocument>(
  "WhatsappMessageLog",
  whatsappMessageLogSchema,
);
