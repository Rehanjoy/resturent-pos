import { Schema, model } from "mongoose";
export interface CostingSettingsInput {
  targetFoodCostPercent: number; targetMarginPercent: number; wastagePercent: number;
  overheadMode: "percentage" | "monthly"; overheadPercent: number;
  monthlyOverheadPaise: number; monthlyPortions: number;
}
export interface DishCostConfigInput {
  packagingPaise: number; laborPaise: number; utilitiesPaise: number; otherPaise: number;
  wastagePercent: number | null; seasonalMonths: number[];
}
export const DEFAULT_COSTING_SETTINGS: CostingSettingsInput = { targetFoodCostPercent: 35, targetMarginPercent: 20, wastagePercent: 0, overheadMode: "percentage", overheadPercent: 0, monthlyOverheadPaise: 0, monthlyPortions: 1 };
export const DEFAULT_DISH_COST_CONFIG: DishCostConfigInput = { packagingPaise: 0, laborPaise: 0, utilitiesPaise: 0, otherPaise: 0, wastagePercent: null, seasonalMonths: [] };
const money = { type: Number, min: 0, validate: Number.isSafeInteger, required: true, default: 0 };
const settingsSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, required: true, unique: true },
  targetFoodCostPercent: { type: Number, min: 0.01, max: 100, default: 35 },
  targetMarginPercent: { type: Number, min: 0, max: 99, default: 20 },
  wastagePercent: { type: Number, min: 0, max: 100, default: 0 },
  overheadMode: { type: String, enum: ["percentage", "monthly"], default: "percentage" },
  overheadPercent: { type: Number, min: 0, max: 1000, default: 0 },
  monthlyOverheadPaise: money,
  monthlyPortions: { type: Number, min: 1, default: 1, validate: Number.isSafeInteger },
}, { timestamps: true });
const configSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, required: true },
  menuItemId: { type: Schema.Types.ObjectId, required: true },
  packagingPaise: money, laborPaise: money, utilitiesPaise: money, otherPaise: money,
  wastagePercent: { type: Number, min: 0, max: 100, default: null },
  seasonalMonths: { type: [Number], default: [] },
}, { timestamps: true });
configSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });
export const CostingSettings = model("CostingSettings", settingsSchema);
export const DishCostConfig = model("DishCostConfig", configSchema);
