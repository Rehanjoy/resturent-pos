import { Schema, model } from "mongoose";

export interface DiningPolicy {
  holdMinutes: number;
  freeCancellationMinutes: number;
  partialCancellationMinutes: number;
  partialChargePercent: number;
  defaultPrepMinutes: number;
}
export const DEFAULT_DINING_POLICY: DiningPolicy = {
  holdMinutes: 5, freeCancellationMinutes: 8, partialCancellationMinutes: 10,
  partialChargePercent: 50, defaultPrepMinutes: 15,
};
export interface SeatSelection { tableId: string; chairNumber: number }
export interface DiningCustomer { contactId: string; name: string; phone: string }
export interface DiningSession {
  id: string;
  tokenHash: string;
  source: "customer" | "staff";
  staffId?: string;
  status: "held" | "occupied" | "cleaning" | "expired" | "released";
  bookingMode: "whole_table" | "chairs";
  assignedWaiter?: { id: string; name: string };
  partySize: number;
  seats: SeatSelection[];
  expiresAt: string | null;
  createdAt: string;
  releasedAt?: string;
  cleaningAt?: string;
  releaseReason?: string;
  orderId?: string;
  policy: DiningPolicy;
  customer?: DiningCustomer;
  submission?: { key: string; fingerprint: string; placedAt: string; items: unknown[]; total: number };
}
export interface DiningFloorDocument {
  restaurantId: string;
  revision: number;
  policy: DiningPolicy;
  sessions: DiningSession[];
  tableBlocks: Record<string, string>;
}
// A restaurant's active seating is one aggregate: compare-and-swap on revision
// commits every selected chair together, including groups spanning tables.
// Mixed nested data is only written by the validated dining service.
const schema = new Schema<DiningFloorDocument>({
  restaurantId: { type: String, required: true, unique: true },
  revision: { type: Number, required: true, default: 0 },
  policy: { type: Schema.Types.Mixed, required: true, default: () => ({ ...DEFAULT_DINING_POLICY }) },
  sessions: { type: Schema.Types.Mixed, default: () => [] },
  tableBlocks: { type: Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });
export const DiningFloor = model<DiningFloorDocument>("DiningFloor", schema);
