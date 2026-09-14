import { asyncHandler } from "../utils/async-handler";
import * as production from "../services/production.service";
export const getPlan = asyncHandler(async (req, res) => res.json(await production.productionPlanDetail(req.user!.restaurantId, String(req.query.day))));
export const savePlan = asyncHandler(async (req, res) => res.json(await production.saveProductionPlan(req.user!.restaurantId, req.body)));
export const saveRecipe = asyncHandler(async (req, res) => res.json(await production.saveRecipe(req.user!.restaurantId, String(req.params.id), req.body)));
export const reconcile = asyncHandler(async (req, res) => res.json(await production.reconcileProductionItem(req.user!.restaurantId, String(req.params.id), String(req.params.itemId), req.user!.userId, req.body)));
