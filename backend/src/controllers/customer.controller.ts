import { asyncHandler } from "../utils/async-handler";
import * as customers from "../services/customer.service";
export const list = asyncHandler(async (req, res) => res.json(await customers.listCustomers(req.user!.restaurantId, String(req.query.search ?? ""), Number(req.query.page ?? 1))));
export const detail = asyncHandler(async (req, res) => res.json(await customers.customerDetail(req.user!.restaurantId, String(req.params.id))));
export const update = asyncHandler(async (req, res) => res.json(await customers.updateCustomer(req.user!.restaurantId, String(req.params.id), req.user!.userId, req.body)));
