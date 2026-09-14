import { Schema, model, type Types } from "mongoose";
export interface CustomerVisitDocument {
  restaurantId: Types.ObjectId;
  contactId: Types.ObjectId;
  sessionId: string;
  nameSnapshot: string;
  phoneSnapshot: string;
  partySize: number;
  seats: { tableId: string; chairNumber: number }[];
  source: "customer" | "staff";
  status: "held" | "occupied" | "cleaning" | "expired" | "released";
  startedAt: Date;
  expiresAt?: Date | null;
  endedAt?: Date;
  orderId?: Types.ObjectId;
  amountPaid: number;
  paidAt?: Date;
}
const schema = new Schema<CustomerVisitDocument>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: true },
  sessionId: { type: String, required: true, unique: true },
  nameSnapshot: { type: String, required: true }, phoneSnapshot: { type: String, required: true },
  partySize: { type: Number, required: true, min: 1 }, seats: { type: Schema.Types.Mixed, required: true },
  source: { type: String, enum: ["customer", "staff"], required: true },
  status: { type: String, enum: ["held", "occupied", "cleaning", "expired", "released"], required: true },
  startedAt: { type: Date, required: true }, expiresAt: { type: Date }, endedAt: { type: Date },
  orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  amountPaid: { type: Number, default: 0, min: 0 }, paidAt: { type: Date },
}, { timestamps: true });
schema.index({ restaurantId: 1, contactId: 1, startedAt: -1 });
schema.index({ restaurantId: 1, orderId: 1 });
export const CustomerVisit = model<CustomerVisitDocument>("CustomerVisit", schema);
