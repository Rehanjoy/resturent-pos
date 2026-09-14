import type { HydratedDocument } from "mongoose";
import {
  InventoryTransaction,
  type InventoryTransactionDocument,
  type InventoryTransactionType,
} from "../models/inventory-transaction.model";

export interface InventoryTransactionDto {
  id: string;
  restaurantId: string;
  itemId: string;
  type: InventoryTransactionType;
  quantityDelta: number;
  reason?: string;
  staffId?: string;
  relatedOrderId?: string;
  createdAt: Date;
}

function toDto(
  transaction: HydratedDocument<InventoryTransactionDocument>,
): InventoryTransactionDto {
  return {
    id: transaction._id.toString(),
    restaurantId: transaction.restaurantId.toString(),
    itemId: transaction.itemId.toString(),
    type: transaction.type,
    quantityDelta: transaction.quantityDelta,
    reason: transaction.reason,
    staffId: transaction.staffId?.toString(),
    relatedOrderId: transaction.relatedOrderId?.toString(),
    createdAt: transaction.createdAt,
  };
}

/**
 * Reads the append-only ledger (see `inventory-transaction.model.ts`) —
 * this is both the "fully audited" stock adjustment log (PRD §3.9) and,
 * filtered to `type: "restock"`, the Supplier module's "purchase history"
 * (PRD §3.9). No writes happen here; every write path (deduction, restock,
 * adjustment) lives next to the state change that causes it, in
 * `inventory-deduction.service.ts` and `inventory-item.service.ts`.
 */
export async function listInventoryTransactions(
  restaurantId: string,
  filters: { itemId?: string; type?: InventoryTransactionType; from?: string; to?: string },
): Promise<InventoryTransactionDto[]> {
  const query: Record<string, unknown> = { restaurantId };
  if (filters.itemId) query.itemId = filters.itemId;
  if (filters.type) query.type = filters.type;
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    query.createdAt = createdAt;
  }

  const transactions = await InventoryTransaction.find(query).sort({ createdAt: -1 });
  return transactions.map(toDto);
}
