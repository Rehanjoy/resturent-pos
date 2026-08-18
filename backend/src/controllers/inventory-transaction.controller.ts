import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as inventoryTransactionService from "../services/inventory-transaction.service";
import type { InventoryTransactionType } from "../models/inventory-transaction.model";

export const listInventoryTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await inventoryTransactionService.listInventoryTransactions(
    req.user!.restaurantId,
    {
      itemId: req.query.itemId as string | undefined,
      type: req.query.type as InventoryTransactionType | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    },
  );
  res.status(200).json({ transactions });
});
