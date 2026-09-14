import { asyncHandler } from "../utils/async-handler";
import * as costing from "../services/costing.service";
export const overview = asyncHandler(async (req, res) => res.json(await costing.costingOverview(req.user!.restaurantId, Number(req.query.days))));
export const settings = asyncHandler(async (req, res) => res.json(await costing.saveCostingSettings(req.user!.restaurantId, req.body)));
export const dish = asyncHandler(async (req, res) => res.json(await costing.saveDishCostConfig(req.user!.restaurantId, String(req.params.id), req.body)));
export const simulate = asyncHandler(async (req, res) => res.json(await costing.simulateDishCost(req.user!.restaurantId, req.body)));

export const history = asyncHandler(async (req, res) => res.json(await costing.ingredientCostHistory(req.user!.restaurantId, String(req.params.id))));
