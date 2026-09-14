export interface CostSettings {
  targetFoodCostPercent: number;
  targetMarginPercent: number;
  wastagePercent: number;
  overheadMode: "percentage" | "monthly";
  overheadPercent: number;
  monthlyOverheadPaise: number;
  monthlyPortions: number;
}
export interface DishCostConfig {
  packagingPaise: number;
  laborPaise: number;
  utilitiesPaise: number;
  otherPaise: number;
  wastagePercent: number | null;
  seasonalMonths: number[];
}
export interface CostIngredient {
  inventoryItemId: string;
  name: string;
  unit: string;
  quantityPerBatch: number;
  quantityPerPortion: number;
  costPerUnit: number;
  costPaise: number;
  missing: boolean;
}
export interface DishCost {
  id: string;
  name: string;
  sellingPricePaise: number;
  recipeYield: number;
  config: DishCostConfig;
  ingredients: CostIngredient[];
  foodCostPaise: number;
  wastagePaise: number;
  overheadPaise: number;
  extraCostPaise: number;
  totalCostPaise: number;
  profitPaise: number;
  marginPercent: number | null;
  foodCostPercent: number | null;
  breakEvenPaise: number;
  suggestedPricePaise: number;
  status: "incomplete" | "loss" | "low_margin" | "healthy";
  explanations: string[];
  inSeason: boolean | null;
  recentPortions: number;
  recentEstimatedProfitPaise: number | null;
}
export interface CostOverview {
  settings: CostSettings;
  ingredients: { id: string; name: string; categoryId: string; unit: string; costPerUnit: number; currentStock: number }[];
  dishes: DishCost[];
  summary: { days: number; totalDishes: number; incompleteDishes: number; lossDishes: number; lowMarginDishes: number; recentPortions: number; recentEstimatedProfitPaise: number; estimateNote: string };
}
export interface CostScenario {
  menuItemId: string;
  sellingPricePaise?: number;
  ingredientRates: { inventoryItemId: string; costPerUnit: number }[];
}

export interface IngredientCostHistory {
  history: { oldCostPerUnit: number; costPerUnit: number; changedAt: string }[];
  linkedDishes: { id: string; name: string }[];
}
