import { Schema, model, type Types } from "mongoose";
import { SPICE_LEVELS, type SpiceLevel } from "./menu-item.model";
import { ORDER_ITEM_STATUSES, type OrderItemStatus } from "./order.model";

export interface KotItemSubdocument {
  /** Links back to the `_id` of the matching item inside `Order.items` —
   * this is how `PATCH /api/kitchen/tickets/:kotId/item-ready` finds and
   * updates the same item on both documents. */
  orderItemId: Types.ObjectId;
  menuItemId: Types.ObjectId;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  estimatedReadyAt?: Date;
}

export interface KotDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  orderId: Types.ObjectId;
  /** Denormalized so the KDS board can render "Table 4" without joining
   * back through `orderId -> Order.tableId` on every render (PRD §5.4). */
  tableId: Types.ObjectId;
  items: KotItemSubdocument[];
  sentAt: Date;
  /** Set once every item on this ticket has been marked ready. */
  allReadyAt?: Date;
  /** Set once every item on this ticket has been served — this is the field
   * `GET /api/kitchen/tickets` filters on to implement "auto-clears ticket
   * from queue upon Serve action" (PRD §3.4) without needing to inspect
   * item-level state on every read. Not part of the PRD's literal field
   * list for this model, but a deliberate addition — see
   * `services/order.service.ts` doc comment on `serveOrder`. */
  servedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const kotItemSchema = new Schema<KotItemSubdocument>(
  {
    orderItemId: { type: Schema.Types.ObjectId, required: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    nameSnapshot: { type: String, required: true, trim: true },
    priceSnapshot: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    spiceLevel: { type: String, enum: SPICE_LEVELS },
    addOns: { type: [String], default: [] },
    notes: { type: String, trim: true },
    itemStatus: { type: String, enum: ORDER_ITEM_STATUSES, required: true },
    estimatedReadyAt: { type: Date },
  },
  { _id: false },
);

/**
 * Kitchen Order Ticket (PRD §3.4/§5.4). One `Kot` is created per "send to
 * kitchen" batch, so a single order can have several KOTs over its
 * lifetime (split-order support) — see `orderId` index below.
 */
const kotSchema = new Schema<KotDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
    items: { type: [kotItemSchema], default: [] },
    sentAt: { type: Date, required: true, default: () => new Date() },
    allReadyAt: { type: Date },
    servedAt: { type: Date },
  },
  { timestamps: true },
);

// Powers the KDS active-ticket board query (`servedAt: null`) and the
// per-order ticket lookups used by `services/kitchen.service.ts`.
kotSchema.index({ restaurantId: 1, servedAt: 1, sentAt: 1 });
kotSchema.index({ restaurantId: 1, orderId: 1 });

export const Kot = model<KotDocument>("Kot", kotSchema);
