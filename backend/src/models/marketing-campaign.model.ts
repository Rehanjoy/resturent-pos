import { Schema, model, type Types } from "mongoose";

export const CAMPAIGN_STATUSES = ["draft", "sending", "completed", "failed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface MarketingCampaignDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  templateId: Types.ObjectId;
  /** Human-readable summary of how the audience was picked, e.g. "All
   * contacts" / "Tag: vip" / "23 contacts (manually selected)" — computed
   * once at send time (`marketing-campaign.service.ts` `resolveAudience`)
   * so the campaign list/detail screens don't need to re-resolve or
   * re-explain the selector after the fact. */
  audienceDescription: string;
  /** The real number of eligible (opted-in) recipients resolved at send
   * time — may be smaller than the raw audience selector matched, since
   * opted-out contacts are silently excluded (never an error). */
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  status: CampaignStatus;
  createdByStaffId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * A WhatsApp broadcast campaign (Marketing module Part 2 of 3).
 *
 * `status: "draft"` exists in the enum for a future "save without sending"
 * UX, but this MVP's `createCampaign` always resolves the audience and
 * sends synchronously in the same request, going straight from
 * (in-memory, not yet persisted) intent to `"sending"` -> `"completed"` /
 * `"failed"` — no campaign row is ever actually created in `"draft"` state
 * today. See `marketing-campaign.service.ts` for the synchronous-send
 * batching approach and why it's an acceptable MVP tradeoff at this app's
 * scale (no background job queue exists in this codebase yet).
 *
 * `sentCount`/`deliveredCount`/`readCount`/`failedCount` are independent
 * running counters, not a funnel that must sum to `recipientCount`:
 * `sentCount`/initial `failedCount` come from this app's own send attempt
 * (`sendTemplateMessage` succeeded or threw); `deliveredCount`/`readCount`
 * (and any later `failedCount` increments) come from Meta's asynchronous
 * webhook status callbacks (`whatsapp-webhook.service.ts`), which can fire
 * multiple status events per message (sent -> delivered -> read) — each
 * one increments its own counter rather than replacing a single "current
 * state" tally, which keeps the increment atomic and race-free across
 * concurrent webhook deliveries.
 */
const marketingCampaignSchema = new Schema<MarketingCampaignDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: "MessageTemplate", required: true },
    audienceDescription: { type: String, required: true, trim: true },
    recipientCount: { type: Number, required: true, default: 0, min: 0 },
    sentCount: { type: Number, required: true, default: 0, min: 0 },
    deliveredCount: { type: Number, required: true, default: 0, min: 0 },
    readCount: { type: Number, required: true, default: 0, min: 0 },
    failedCount: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: CAMPAIGN_STATUSES, required: true, default: "draft" },
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

marketingCampaignSchema.index({ restaurantId: 1, createdAt: -1 });
marketingCampaignSchema.index({ restaurantId: 1, status: 1 });

export const MarketingCampaign = model<MarketingCampaignDocument>(
  "MarketingCampaign",
  marketingCampaignSchema,
);
