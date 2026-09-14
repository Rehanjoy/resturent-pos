import { Schema, model, type Types } from "mongoose";

export type ServiceRequestType = "water" | "bill" | "help";
export type ServiceRequestStatus = "pending" | "acknowledged" | "completed" | "expired";
export interface ServiceRequestDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  sessionId: string;
  type: ServiceRequestType;
  note: string;
  status: ServiceRequestStatus;
  isOpen: boolean;
  seats: { tableId: string; chairNumber: number; tableName: string }[];
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ServiceRequestDocument>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  sessionId: { type: String, required: true },
  type: { type: String, enum: ["water", "bill", "help"], required: true },
  note: { type: String, maxlength: 160, default: "" },
  status: { type: String, enum: ["pending", "acknowledged", "completed", "expired"], default: "pending" },
  isOpen: { type: Boolean, default: true },
  seats: { type: [{ _id: false, tableId: { type: String, required: true }, chairNumber: { type: Number, required: true }, tableName: { type: String, required: true } }], required: true },
  acknowledgedAt: Date,
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
  completedAt: Date,
  completedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
// Acknowledgement keeps this slot occupied until completion. Concurrent taps
// cannot create duplicate waiter tickets, even across backend processes.
schema.index({ restaurantId: 1, sessionId: 1, type: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
schema.index({ restaurantId: 1, status: 1, createdAt: 1 });
schema.index({ restaurantId: 1, sessionId: 1, createdAt: -1 });
export const ServiceRequest = model<ServiceRequestDocument>("ServiceRequest", schema);
