import { api } from "@/lib/api";
import type { CostOverview, CostSettings, DishCost, DishCostConfig, CostScenario, IngredientCostHistory } from "./types";

export const costingApi = {
  overview: (days: number) => api.get<CostOverview>(`/api/inventory/costing?days=${days}`),
  settings: (input: CostSettings) => api.patch<CostSettings>("/api/inventory/costing/settings", input),
  configure: (id: string, input: DishCostConfig) => api.patch<DishCostConfig>(`/api/inventory/costing/dishes/${id}`, input),
  simulate: (input: CostScenario) => api.post<DishCost>("/api/inventory/costing/simulate", input),
  ingredientHistory: (id: string) => api.get<IngredientCostHistory>(`/api/inventory/costing/ingredients/${id}/history`),
};
