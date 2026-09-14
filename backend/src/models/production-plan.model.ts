import { Schema, model, type Types } from "mongoose";
export interface ProductionRequirement {
  itemId: string; name: string; unit: string; requiredMicros: number; costPaise: number;
}
export interface ProductionPlanDocument {
  _id: Types.ObjectId; restaurantId: Types.ObjectId; day: string;
  dishes: { menuItemId: string; name: string; portions: number }[];
  requirements: ProductionRequirement[];
  locked: boolean; updatedAt: Date;
}
const schema = new Schema<ProductionPlanDocument>({
  restaurantId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true },
  dishes: { type: [{ _id: false, menuItemId: String, name: String, portions: Number }], default: [] },
  requirements: { type: [{ _id: false, itemId: String, name: String, unit: String, requiredMicros: Number, costPaise: Number }], default: [] },
  locked: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ restaurantId: 1, day: 1 }, { unique: true });
export const ProductionPlan = model<ProductionPlanDocument>("ProductionPlan", schema);
export interface InventoryReconciliationDocument {
  _id: Types.ObjectId; restaurantId: Types.ObjectId; planId: Types.ObjectId; itemId: Types.ObjectId;
  day: string; actualUsedMicros: number; actualWastedMicros: number; usedDifferenceMicros: number;
  wasteDifferenceMicros: number; staffId: Types.ObjectId; appliedAt?: Date;
}
const reconciliationSchema = new Schema<InventoryReconciliationDocument>({
  restaurantId: { type: Schema.Types.ObjectId, required: true }, planId: { type: Schema.Types.ObjectId, required: true },
  itemId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true },
  actualUsedMicros: { type: Number, required: true }, actualWastedMicros: { type: Number, required: true },
  usedDifferenceMicros: { type: Number, required: true }, wasteDifferenceMicros: { type: Number, required: true },
  staffId: { type: Schema.Types.ObjectId, required: true }, appliedAt: Date,
}, { timestamps: true });
reconciliationSchema.index({ restaurantId: 1, planId: 1, itemId: 1 }, { unique: true });
export const InventoryReconciliation = model<InventoryReconciliationDocument>("InventoryReconciliation", reconciliationSchema);
