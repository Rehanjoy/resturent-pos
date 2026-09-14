import { AppError } from "../utils/app-error";

/** Millionths of the item's existing unit: kg, litres, pieces, etc. No unit conversion
 * is inferred from free-text labels. Values with greater precision are rejected. */
export const QUANTITY_SCALE = 1_000_000;
export function quantityToMicros(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) throw new AppError("Quantity must be finite and at most 1,000,000 units.", 400, "QUANTITY_RANGE");
  const scaled = value * QUANTITY_SCALE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 0.0001) throw new AppError("Use at most 6 decimal places for quantities.", 400, "QUANTITY_PRECISION");
  return rounded;
}
export function quantityFromMicros(value: number): number { return value / QUANTITY_SCALE; }
export function recipeRequirementMicros(quantity: number, portions: number, yieldPortions = 1): number {
  const numerator = BigInt(quantityToMicros(quantity)) * BigInt(portions);
  const divisor = BigInt(yieldPortions);
  const result = Number((numerator + divisor - 1n) / divisor);
  if (!Number.isSafeInteger(result) || result > 1_000_000 * QUANTITY_SCALE) throw new AppError("Planned quantity is too large.", 400, "QUANTITY_RANGE");
  return result;
}
export function quantityCostPaise(micros: number, costPerUnit: number): number {
  return Number((BigInt(micros) * BigInt(costPerUnit) + BigInt(QUANTITY_SCALE / 2)) / BigInt(QUANTITY_SCALE));
}
/** Atomic pipeline avoids repeatedly adding binary fractions to stock. */
export function stockMovementPipeline(deltaMicros: number, deductionKey?: string) {
  return [{ $set: {
    currentStock: { $divide: [{ $add: [{ $round: [{ $multiply: ["$currentStock", QUANTITY_SCALE] }, 0] }, deltaMicros] }, QUANTITY_SCALE] },
    updatedAt: new Date(),
    ...(deductionKey ? { processedDeductionKeys: { $setUnion: [{ $ifNull: ["$processedDeductionKeys", []] }, [deductionKey]] } } : {}),
  } }];
}
