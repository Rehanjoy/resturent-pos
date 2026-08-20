import { Schema, model, type Types } from "mongoose";

export interface WhatsappConfigDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  phoneNumberId: string;
  wabaId?: string;
  accessTokenEncrypted: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isConnected: boolean;
  connectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One WhatsApp connection per restaurant (`restaurantId` is `unique`) — the
 * Marketing module's Setup tab (this is Part 1 of 3; Part 2 adds
 * campaigns/broadcast, Part 3 adds the AI auto-reply inbox, both of which
 * read this same config to know which restaurant is connected to which
 * Meta phone number).
 *
 * `phoneNumberId` and `wabaId` are Meta identifiers, not secrets — safe as
 * plain strings. `accessTokenEncrypted` is Meta's permanent WhatsApp Cloud
 * API access token, AES-256-GCM encrypted via `utils/encryption.ts` before
 * it's ever written here; `select: false` so it never comes back on a
 * normal `find`/`findOne`, matching `User.passwordHash`'s own convention —
 * only `whatsapp-config.service.ts` opts into it explicitly, and only to
 * decrypt for an outbound Meta API call, never to return it in an API
 * response.
 */
const whatsappConfigSchema = new Schema<WhatsappConfigDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
    },
    phoneNumberId: { type: String, required: true, trim: true },
    wabaId: { type: String, trim: true },
    accessTokenEncrypted: { type: String, required: true, select: false },
    // Populated from Meta's phone metadata on connect (`verifyPhoneNumber`)
    // — never accepted directly from the client, so the admin UI can't be
    // tricked into showing a fake "verified" identity.
    displayPhoneNumber: { type: String, trim: true },
    verifiedName: { type: String, trim: true },
    isConnected: { type: Boolean, required: true, default: false },
    connectedAt: { type: Date },
  },
  { timestamps: true },
);

export const WhatsappConfig = model<WhatsappConfigDocument>(
  "WhatsappConfig",
  whatsappConfigSchema,
);
