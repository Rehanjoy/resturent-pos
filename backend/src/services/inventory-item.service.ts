import { quantityToMicros, stockMovementPipeline } from "./inventory-quantity.service";
import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { InventoryCategory } from "../models/inventory-category.model";
import { Supplier } from "../models/supplier.model";
import { InventoryItem, type InventoryItemDocument } from "../models/inventory-item.model";
import { InventoryTransaction } from "../models/inventory-transaction.model";
import { getDailyInventoryActivity, type DailyInventoryActivity } from "./inventory-reporting.service";
import { MenuItem } from "../models/menu-item.model";

export interface InventoryItemDto {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  reorderThreshold: number;
  expectedDailyUsage: number;
  daysRemaining: number | null;
  stockAlert: "healthy" | "warning" | "critical";
  today?: DailyInventoryActivity;
  supplierId?: string;
  reorderRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
}
function toDto(item: HydratedDocument<InventoryItemDocument>): InventoryItemDto {
  return {
    id: item._id.toString(),
    restaurantId: item.restaurantId.toString(),
    categoryId: item.categoryId.toString(),
    name: item.name,
    unit: item.unit,
    costPerUnit: item.costPerUnit,
    currentStock: item.currentStock,
    reorderThreshold: item.reorderThreshold,
    expectedDailyUsage: item.expectedDailyUsage ?? 0,
    daysRemaining: item.expectedDailyUsage > 0 ? Math.max(0, item.currentStock) / item.expectedDailyUsage : null,
    stockAlert: item.currentStock <= 0 ? "critical" : item.currentStock <= item.reorderThreshold ? "warning" : "healthy",
    supplierId: item.supplierId?.toString(),
    reorderRequested: item.reorderRequested,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function assertCategoryExists(restaurantId: string, categoryId: string): Promise<void> {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new AppError("Selected category does not exist.", 400, "CATEGORY_NOT_FOUND");
  }
  const category = await InventoryCategory.findOne({ _id: categoryId, restaurantId });
  if (!category) {
    throw new AppError("Selected category does not exist.", 400, "CATEGORY_NOT_FOUND");
  }
}

async function assertSupplierExists(restaurantId: string, supplierId: string): Promise<void> {
  if (!Types.ObjectId.isValid(supplierId)) {
    throw new AppError("Selected supplier does not exist.", 400, "SUPPLIER_NOT_FOUND");
  }
  const supplier = await Supplier.findOne({ _id: supplierId, restaurantId });
  if (!supplier) {
    throw new AppError("Selected supplier does not exist.", 400, "SUPPLIER_NOT_FOUND");
  }
}

async function findInventoryItemOrThrow(
  restaurantId: string,
  itemId: string,
): Promise<HydratedDocument<InventoryItemDocument>> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AppError("Inventory item not found.", 404, "NOT_FOUND");
  }
  const item = await InventoryItem.findOne({ _id: itemId, restaurantId });
  if (!item) {
    throw new AppError("Inventory item not found.", 404, "NOT_FOUND");
  }
  return item;
}

/**
 * Clears the "Reorder" badge the moment stock is back above threshold
 * (per the `InventoryItem.reorderRequested` doc comment). Called after
 * every stock-increasing change (`updateInventoryItem` restock,
 * `adjustInventoryItem`) — never after a deduction, since a deduction can
 * only move stock further from "healthy", never closer to it.
 */
function maybeClearReorderRequested(item: HydratedDocument<InventoryItemDocument>): void {
  if (item.reorderRequested && item.currentStock > item.reorderThreshold) {
    item.reorderRequested = false;
  }
}

export async function listInventoryItems(
  restaurantId: string,
  filters: { categoryId?: string; search?: string },
): Promise<InventoryItemDto[]> {
  const query: Record<string, unknown> = { restaurantId };
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.search) {
    // Escape regex metacharacters in free-text search input — never build a
    // regex directly from unescaped user input.
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: escaped, $options: "i" };
  }

  const items = await InventoryItem.find(query).sort({ name: 1 });
  const activity = await getDailyInventoryActivity(restaurantId);
  return items.map((item) => ({ ...toDto(item), today: activity.get(item.id) ?? { received: 0, used: 0, wasted: 0, corrected: 0 } }));
}

export interface InventoryItemInput {
  categoryId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  currentStock?: number;
  reorderThreshold?: number;
  expectedDailyUsage?: number;
  supplierId?: string;
}

export async function createInventoryItem(
  restaurantId: string,
  input: InventoryItemInput,
): Promise<InventoryItemDto> {
  await assertCategoryExists(restaurantId, input.categoryId);
  if (input.supplierId) await assertSupplierExists(restaurantId, input.supplierId);

  const item = await InventoryItem.create({
    restaurantId,
    categoryId: input.categoryId,
    name: input.name,
    unit: input.unit,
    costPerUnit: input.costPerUnit,
    currentStock: input.currentStock ?? 0,
    reorderThreshold: input.reorderThreshold ?? 0,
    expectedDailyUsage: input.expectedDailyUsage ?? 0,
    supplierId: input.supplierId || undefined,
    reorderRequested: false,
  });
  return toDto(item);
}

/**
 * `currentStock` is accepted here only as a way to *record a restock*
 * (received more stock from the supplier) — see the module doc comment in
 * `inventory-item.validators.ts`. A decrease is rejected with
 * `STOCK_DECREASE_NOT_ALLOWED` so every stock reduction is forced through
 * `adjustInventoryItem`, which requires an audit reason (PRD §3.9 "fully
 * audited"). `staffId` is only used to attribute the restock transaction
 * this may create.
 */
export async function updateInventoryItem(
  restaurantId: string,
  staffId: string,
  itemId: string,
  input: Partial<InventoryItemInput>,
): Promise<InventoryItemDto> {
  const item = await findInventoryItemOrThrow(restaurantId, itemId);

  if (input.categoryId !== undefined) {
    await assertCategoryExists(restaurantId, input.categoryId);
    item.categoryId = new Types.ObjectId(input.categoryId);
  }
  if (input.supplierId !== undefined) {
    if (input.supplierId) await assertSupplierExists(restaurantId, input.supplierId);
    item.supplierId = input.supplierId ? new Types.ObjectId(input.supplierId) : undefined;
  }
  if (input.expectedDailyUsage !== undefined) item.expectedDailyUsage = input.expectedDailyUsage;
  if (input.name !== undefined) item.name = input.name;
  if (input.unit !== undefined && input.unit !== item.unit) {
    if (await MenuItem.exists({ restaurantId, "ingredientMapping.inventoryItemId": item._id })) {
      throw new AppError("This unit is used by a recipe. Create a new inventory item in the required unit and relink measured recipes.", 409, "INGREDIENT_UNIT_LOCKED");
    }
    item.unit = input.unit;
  }
  if (input.costPerUnit !== undefined && input.costPerUnit !== item.costPerUnit) {
    item.priceHistory ??= [];
    item.priceHistory.push({ oldCostPerUnit: item.costPerUnit, costPerUnit: input.costPerUnit, changedAt: new Date() });
    if (item.priceHistory.length > 120) item.priceHistory.splice(0, item.priceHistory.length - 120);
    item.costPerUnit = input.costPerUnit;
  }
  if (input.reorderThreshold !== undefined) item.reorderThreshold = input.reorderThreshold;

  let restockDelta = 0;
  if (input.currentStock !== undefined && input.currentStock !== item.currentStock) {
    if (input.currentStock < item.currentStock) {
      throw new AppError(
        "Stock can only be reduced through the stock adjustment action, so the reason is recorded.",
        400,
        "STOCK_DECREASE_NOT_ALLOWED",
      );
    }
    restockDelta = input.currentStock - item.currentStock;
    item.currentStock = input.currentStock;
  }

  maybeClearReorderRequested(item);
  await item.save();

  if (restockDelta > 0) {
    await InventoryTransaction.create({
      restaurantId,
      itemId: item._id,
      type: "restock",
      quantityDelta: restockDelta,
      staffId,
    });
  }

  return toDto(item);
}

export async function deleteInventoryItem(restaurantId: string, itemId: string): Promise<void> {
  const item = await findInventoryItemOrThrow(restaurantId, itemId);

  const linkedDishCount = await MenuItem.countDocuments({
    restaurantId,
    "ingredientMapping.inventoryItemId": item._id,
  });
  if (linkedDishCount > 0) {
    throw new AppError(
      "This item is used in one or more dish recipes. Remove it from those dishes first.",
      409,
      "INVENTORY_ITEM_IN_USE",
    );
  }

  await item.deleteOne();
}

export interface AdjustInventoryItemInput {
  movementType?: "restock" | "usage" | "wastage" | "adjustment";
  quantityDelta: number;
  reason: string;
}

/**
 * Manual stock adjustment — wastage or a correction to what's physically on
 * the shelf (PRD §3.9 "Stock adjustment log ... fully audited"). Unlike
 * order-driven deduction, this is a deliberate staff action, so it's
 * allowed to move stock in either direction, but always requires a reason.
 * The reason requirement is enforced at the validation edge
 * (`adjustInventoryItemSchema`) AND again here defensively, so the
 * invariant holds for any future caller that reaches this service function
 * directly (e.g. a script), not just the HTTP route.
 */
export async function adjustInventoryItem(
  restaurantId: string,
  staffId: string,
  itemId: string,
  input: AdjustInventoryItemInput,
): Promise<InventoryItemDto> {
  if (!input.reason || !input.reason.trim()) {
    throw new AppError("A reason is required for a stock adjustment.", 400, "REASON_REQUIRED");
  }
  if (!Number.isFinite(input.quantityDelta) || !input.quantityDelta) {
    throw new AppError("Adjustment quantity can't be zero.", 400, "VALIDATION_ERROR");
  }

  const movementType = input.movementType ?? "adjustment";
  if ((movementType === "restock" && input.quantityDelta < 0) ||
      ((movementType === "usage" || movementType === "wastage") && input.quantityDelta > 0)) {
    throw new AppError("Receipts must add stock; usage and wastage must remove stock.", 400, "VALIDATION_ERROR");
  }
  await findInventoryItemOrThrow(restaurantId, itemId);
  // Atomic increment preserves concurrent kitchen deductions and deliveries.
  const item = await InventoryItem.findOneAndUpdate(
    { _id: itemId, restaurantId }, stockMovementPipeline(quantityToMicros(input.quantityDelta)), { returnDocument: "after", updatePipeline: true },
  );
  if (!item) throw new AppError("Inventory item not found.", 404, "NOT_FOUND");
  if (input.quantityDelta > 0) {
    await InventoryItem.updateOne(
      { _id: itemId, restaurantId, $expr: { $gt: ["$currentStock", "$reorderThreshold"] } },
      { $set: { reorderRequested: false } },
    );
    maybeClearReorderRequested(item);
  }

  await InventoryTransaction.create({
    restaurantId,
    itemId: item._id,
    type: movementType,
    quantityDelta: input.quantityDelta,
    reason: input.reason.trim(),
    staffId,
  });

  return toDto(item);
}

/** Flips the "Reorder" / "Reordered" status badge — "I've placed the order
 * with the supplier" is the only thing this records; the flag still
 * auto-clears on its own once the restock actually lands (see
 * `maybeClearReorderRequested`). */
export async function toggleReorderRequested(
  restaurantId: string,
  itemId: string,
): Promise<InventoryItemDto> {
  const item = await findInventoryItemOrThrow(restaurantId, itemId);
  item.reorderRequested = !item.reorderRequested;
  await item.save();
  return toDto(item);
}

export interface LowStockItemDto {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
}

/**
 * Powers the Dashboard's low-stock widget (PRD §3.2) and the Inventory
 * screen's "Low on Stock" KPI card. "Low" = at or below the reorder
 * threshold, matching `InventoryItem.reorderRequested`'s own trigger
 * condition.
 */
export async function getLowStockSummary(
  restaurantId: string,
  limit = 5,
): Promise<{ count: number; items: LowStockItemDto[] }> {
  const filter = { restaurantId, $expr: { $lte: ["$currentStock", "$reorderThreshold"] } };
  const [count, items] = await Promise.all([
    InventoryItem.countDocuments(filter),
    InventoryItem.find(filter).sort({ currentStock: 1 }).limit(limit),
  ]);

  return {
    count,
    items: items.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      unit: item.unit,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
    })),
  };
}
