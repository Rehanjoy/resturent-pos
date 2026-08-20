import { Schema, model, type Types } from "mongoose";

export const MESSAGE_TEMPLATE_CATEGORIES = ["marketing", "utility", "authentication"] as const;
export type MessageTemplateCategory = (typeof MESSAGE_TEMPLATE_CATEGORIES)[number];

export const MESSAGE_TEMPLATE_STATUSES = ["approved", "pending", "rejected"] as const;
export type MessageTemplateStatus = (typeof MESSAGE_TEMPLATE_STATUSES)[number];

export interface MessageTemplateDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  metaTemplateId: string;
  name: string;
  language: string;
  category: MessageTemplateCategory;
  /** The BODY component's text, `{{1}}`-style placeholders exactly as Meta
   * stores them — never edited locally, this app only reads what's already
   * approved on the connected WABA (see `message-template.service.ts`
   * `syncMessageTemplates`, the only writer). */
  bodyText: string;
  status: MessageTemplateStatus;
  /** Parsed from `bodyText`'s highest `{{n}}` placeholder — lets the
   * campaign UI know exactly how many body-param inputs to collect before
   * a send, without re-parsing the string on every render. */
  variableCount: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Local read-only cache of the restaurant's WABA-approved WhatsApp message
 * templates (Marketing module Part 2 of 3). This app never creates or
 * submits templates to Meta — `POST /api/marketing/templates/sync`
 * (`message-template.service.ts` `syncMessageTemplates`) is the only writer
 * anywhere in the codebase, and it always upserts by `{restaurantId,
 * metaTemplateId}`, so re-syncing is idempotent and safe to run as often as
 * the admin likes. `status` mirrors Meta's own review outcome — campaigns
 * can only be created against a `status: "approved"` template
 * (`marketing-campaign.service.ts` `createCampaign`), enforced server-side,
 * never trusted from the client.
 */
const messageTemplateSchema = new Schema<MessageTemplateDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    metaTemplateId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true },
    category: { type: String, enum: MESSAGE_TEMPLATE_CATEGORIES, required: true },
    bodyText: { type: String, required: true },
    status: { type: String, enum: MESSAGE_TEMPLATE_STATUSES, required: true },
    variableCount: { type: Number, required: true, default: 0, min: 0 },
    syncedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// One local row per Meta template (per restaurant) — the sync upsert key.
messageTemplateSchema.index({ restaurantId: 1, metaTemplateId: 1 }, { unique: true });
// Powers the New Campaign screen's "approved templates only" filter.
messageTemplateSchema.index({ restaurantId: 1, status: 1 });

export const MessageTemplate = model<MessageTemplateDocument>(
  "MessageTemplate",
  messageTemplateSchema,
);
