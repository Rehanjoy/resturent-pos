/** Display six-decimal stock values without hiding gram-level movements. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(value);
}

export function recipeUnits(baseUnit: string): { label: string; factor: number }[] {
  const unit = baseUnit.trim().toLowerCase();
  if (["kg", "kilogram", "kilograms"].includes(unit)) return [{ label: baseUnit, factor: 1 }, { label: "g", factor: 1000 }];
  if (["l", "litre", "liter", "litres", "liters"].includes(unit)) return [{ label: baseUnit, factor: 1 }, { label: "ml", factor: 1000 }];
  return [{ label: baseUnit, factor: 1 }];
}

export function formatStockQuantity(value: number, unit: string): string {
  const fine = recipeUnits(unit)[1];
  return `${formatQuantity(value)} ${unit}${fine ? ` (${formatQuantity(value * fine.factor)} ${fine.label})` : ""}`;
}

export function toBaseQuantity(value: number, factor: number): number {
  return Number((value / factor).toFixed(6));
}
