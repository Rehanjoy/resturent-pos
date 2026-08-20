import { Schema, model, type Types } from "mongoose";
import { E164_PHONE_REGEX } from "../utils/phone";

export const CONTACT_SOURCES = ["manual", "csv_import", "reservation", "order"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export interface ContactDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source: ContactSource;
  optedIn: boolean;
  notes?: string;
  createdByStaffId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A WhatsApp-reachable contact for the Marketing module (Part 1: manual add
 * + CSV import; Part 2 will add `reservation`/`order` auto-sync sources and
 * filter campaign audiences on `tags`/`optedIn` — both fields exist here
 * already so Part 2 doesn't need a migration).
 *
 * `phone` is E.164 (`"+919876543210"`) — the format the WhatsApp Business
 * Cloud API requires for every recipient (`utils/phone.ts`). The compound
 * `{restaurantId, phone}` unique index is the "one contact per phone number
 * per restaurant" invariant: re-adding an existing number (manually or via
 * CSV) updates that contact rather than creating a duplicate — see
 * `contact.service.ts` `createContact`/`importContactsFromCsv`.
 */
const contactSchema = new Schema<ContactDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      // Defensive second layer — `contact.validators.ts` `e164PhoneSchema`
      // is the edge validator every write actually goes through.
      match: E164_PHONE_REGEX,
    },
    email: { type: String, trim: true, lowercase: true },
    tags: { type: [{ type: String, trim: true }], default: [] },
    source: { type: String, enum: CONTACT_SOURCES, required: true, default: "manual" },
    // Defaults true so a manually-added or imported contact starts eligible
    // for Part 2's broadcast sends; flips false through the opt-out
    // mechanism that ships alongside that send flow.
    optedIn: { type: Boolean, required: true, default: true },
    notes: { type: String, trim: true },
    // Null/absent for auto-synced contacts (Part 2's `reservation`/`order`
    // sources) — only set when a staff member added the contact themselves.
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

contactSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });
// Powers Part 2's campaign-audience filtering (`?tag=` on the list
// endpoint already uses this too) — added now so it's in place before that
// query pattern exists, not bolted on as a slow migration later.
contactSchema.index({ restaurantId: 1, tags: 1 });

export const Contact = model<ContactDocument>("Contact", contactSchema);
