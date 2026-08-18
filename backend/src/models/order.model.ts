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
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  /** Set the moment this specific item is included in a "send to kitchen" batch. */
  sentAt?: Date;
}

export interface OrderDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  status: OrderStatus;
  items: Types.DocumentArray<OrderItemSubdocument>;
  createdByStaffId: Types.ObjectId;
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
    createdByStaffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
