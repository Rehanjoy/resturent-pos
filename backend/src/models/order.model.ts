import { Schema, model, Types } from "mongoose";
import { SPICE_LEVELS, type SpiceLevel } from "./menu-item.model";

export const ORDER_STATUSES = [
  "draft",
  "sent",
  "in_kitchen",
  "ready",
  "served",
  "billed",
  "closed",
  "void",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_STATUSES = ["pending", "sent", "ready", "served"] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export interface OrderItemSubdocument {
  _id: Types.ObjectId;
  menuItemId: Types.ObjectId;
  /** Denormalized dish name at the time it was added (PRD §5.4) — historical
   * orders must survive later menu renames/price edits. */
  nameSnapshot: string;
  /** Denormalized price at the time it was added, integer paise. */
  priceSnapshot: number;
  qty: number;
  /** Quantity cancelled from the original line. The original quantity is
   * retained so staff can see what was ordered and what was cancelled. */
  cancelledQty: number;
  /** Public QR submission that created this line; used for durable replay. */
  guestSubmissionKey?: string;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  /** Set the moment this specific item is included in a "send to kitchen" batch. */
  sentAt?: Date;
  estimatedReadyAt?: Date;
}

export interface OrderDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  status: OrderStatus;
  items: Types.DocumentArray<OrderItemSubdocument>;
  createdByStaffId?: Types.ObjectId;
  source?: "qr" | "staff";
  diningSessionId?: string;
  assignedWaiter?: { id: string; name: string };
  seats?: { tableId: string; chairNumber: number }[];
  placedAt?: Date;
  customerTotal?: number;
  cancellation?: { chargePercent: number; amountDue: number; cancelledAt: Date; reason: string };
  guestSubmissions?: { key: string; fingerprint: string; placedAt: Date }[];
  cancellations?: {
    _id: Types.ObjectId;
    idempotencyKey?: string;
    fingerprint?: string;
    reason: string;
    cancelledAt: Date;
    lines: { orderItemId: Types.ObjectId; nameSnapshot: string; qty: number; unitPrice: number; subtotal: number; chargePercent: number; baseCharge: number; taxLines: { name: string; ratePercent: number; amount: number }[]; amountDue: number }[];
    selectedSubtotal: number;
    baseCharge: number;
    taxLines: { name: string; ratePercent: number; amount: number }[];
    amountDue: number;
  }[];
  servedByStaffId?: Types.ObjectId;
  /** Required audit reason when an order is voided (PRD §3.3, §3.10). */
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItemSubdocument>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    nameSnapshot: { type: String, required: true, trim: true },
    priceSnapshot: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    cancelledQty: { type: Number, required: true, min: 0, default: 0 },
    guestSubmissionKey: { type: String, trim: true },
    spiceLevel: { type: String, enum: SPICE_LEVELS },
    addOns: { type: [String], default: [] },
    notes: { type: String, trim: true },
    itemStatus: {
      type: String,
      enum: ORDER_ITEM_STATUSES,
      required: true,
      default: "pending",
    },
    sentAt: { type: Date },
    estimatedReadyAt: { type: Date },
  },
  { _id: true },
);

/**
 * A table's order session (PRD §3.3). This build covers the lifecycle
 * `draft -> sent -> in_kitchen -> ready -> served`; `billed`/`closed` are
 * included in the enum now so the Billing module (next part) has valid
 * target states to transition into, but nothing in this module ever sets
 * them. See `services/order.service.ts` for the full state-machine
 * documentation, including how multiple KOTs per order are tracked.
 */
const orderSchema = new Schema<OrderDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: "draft",
    },
    items: { type: [orderItemSchema], default: [] },
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["qr", "staff"], default: "staff" },
    diningSessionId: { type: String, index: true },
    assignedWaiter: { type: Schema.Types.Mixed },
    seats: { type: Schema.Types.Mixed },
    placedAt: { type: Date },
    customerTotal: { type: Number, min: 0 },
    cancellation: { type: Schema.Types.Mixed },
    guestSubmissions: { type: Schema.Types.Mixed, default: () => [] },
    cancellations: { type: Schema.Types.Mixed, default: () => [] },
    servedByStaffId: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true },
);

// Required compound index (PRD §5.4) — powers the order list/filter screen
// and "does this table already have a live order" lookups.
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, tableId: 1 });

export const Order = model<OrderDocument>("Order", orderSchema);
