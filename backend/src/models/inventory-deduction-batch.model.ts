import { Schema, model, type Types } from "mongoose";
interface InventoryDeductionBatchDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  orderId: Types.ObjectId;
  ingredients: { itemId: string; quantity: number }[];
}
/** Immutable recipe snapshot: retried QR submissions must use the original quantities,
 * even if an administrator edits a dish recipe between attempts. */
const schema = new Schema<InventoryDeductionBatchDocument>({
  restaurantId: { type: Schema.Types.ObjectId, required: true },
  orderId: { type: Schema.Types.ObjectId, required: true },
  ingredients: { type: [{ _id: false, itemId: { type: String, required: true }, quantity: { type: Number, required: true } }], required: true },
}, { timestamps: true });
schema.index({ restaurantId: 1, orderId: 1 });
export const InventoryDeductionBatch = model<InventoryDeductionBatchDocument>("InventoryDeductionBatch", schema);
