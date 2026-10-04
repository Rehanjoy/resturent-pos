import { emitToRestaurant } from "../sockets";
import { recipeRequirementMicros, quantityFromMicros, stockMovementPipeline } from "./inventory-quantity.service";
import { createHash } from "node:crypto";
import { InventoryDeductionBatch } from "../models/inventory-deduction-batch.model";
import { Types } from "mongoose";
import { MenuItem } from "../models/menu-item.model";
import { InventoryItem } from "../models/inventory-item.model";
import { InventoryTransaction } from "../models/inventory-transaction.model";

export interface SentItemForDeduction {
  menuItemId: string;
  qty: number;
}

/**
 * Auto-deducts mapped ingredient stock for items that were just sent to the
 * kitchen (PRD §3.9 "on order confirmation, system deducts mapped
 * ingredient quantities from stock ... atomic transaction to prevent race
 * conditions on concurrent orders"). Called from
 * `order.service.ts` `sendToKitchen`.
 *
 * Three judgment calls made here, documented per the build brief:
 *
 * 1. TRIGGER POINT — this app's order lifecycle has no "confirm" step
 *    distinct from creation (see `order.model.ts`'s state machine:
 *    draft -> sent -> in_kitchen -> ready -> served). The closest real
 *    analogue to "the kitchen is now actually using these ingredients" is
 *    send-to-kitchen: a draft can still be freely edited/abandoned (nothing
 *    should be deducted for items that never left the table's tab), and by
 *    the time an item is "served" the kitchen already consumed the stock
 *    while cooking it — deducting that late would let concurrent orders
 *    both believe they had enough stock to *start* cooking. Send-to-kitchen
 *    is also the one moment already backed by a hard state transition and
 *    a KOT, so it reads naturally as "confirmed" in this codebase's terms.
 *
 * 2. ATOMICITY WITHOUT A MULTI-DOCUMENT TRANSACTION — each ingredient's
 *    stock lives in its own `InventoryItem` document. A single-document
 *    `findOneAndUpdate` with `$inc` is atomic per document even without a
 *    replica set / multi-document Mongo transaction: two concurrent orders
 *    decrementing the same ingredient both apply cleanly, with no lost
 *    update — that's the actual race condition PRD §4 calls out. A
 *    multi-document transaction spanning every ingredient in one order
 *    isn't needed on top of that: there's no invariant requiring "all
 *    ingredients for this order deduct together or not at all" — each
 *    ingredient's stock is independently meaningful, and partial deduction
 *    (e.g. one ingredient's `InventoryItem` was deleted) is not a reason to
 *    stop deducting the others.
 *
 * 3. NEGATIVE STOCK — if a decrement takes `currentStock` below zero, this
 *    does NOT block or roll back the order. A restaurant cannot refuse to
 *    serve a dish that's already cooking because the stock ledger is
 *    slightly off (uncounted waste, a supplier delivery not yet logged,
 *    portion-size drift, etc. all cause this in real kitchens). The
 *    low-stock/reorder signal (`currentStock <= reorderThreshold`) already
 *    surfaces this to staff on the Dashboard and Inventory screen; this
 *    function logs it clearly with `console.error` instead of throwing, so
 *    the condition is visible without blocking service. The entire
 *    function body also runs inside a top-level try/catch: an unexpected
 *    error here (a bad ingredient mapping, a DB hiccup) is logged and
 *    swallowed rather than propagated, so a problem in this side effect can
 *    never fail the "send to kitchen" request that triggered it.
 */
/** A batchKey enables durable replay: snapshot recipe, atomic per-item key + stock,
 * and deterministic ledger upsert. Keyed failures propagate so the caller can retry. */
export async function deductInventoryForSentItems(
  restaurantId: string,
  staffId: string | undefined,
  orderId: string,
  items: SentItemForDeduction[],
  batchKey?: string,
): Promise<void> {
  let stockChanged = false;
  try {
    const menuItemIds = [...new Set(items.map((item) => item.menuItemId))].filter(Types.ObjectId.isValid);
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, restaurantId }).select("ingredientMapping recipeYield").lean();
    const mappings = new Map(menuItems.map((item) => [item._id.toString(), item]));
    const totals = new Map<string, number>();
    for (const item of items) {
      const recipe = mappings.get(item.menuItemId);
      for (const ingredient of recipe?.ingredientMapping ?? []) {
        const itemId = ingredient.inventoryItemId.toString();
        const quantity = recipeRequirementMicros(ingredient.quantityPerRecipe ?? ingredient.quantityPerUnit, item.qty, ingredient.quantityPerRecipe === undefined ? 1 : recipe?.recipeYield ?? 1);
        if (Types.ObjectId.isValid(itemId) && Number.isFinite(quantity) && quantity > 0) totals.set(itemId, (totals.get(itemId) ?? 0) + quantity);
      }
    }
    let ingredients = [...totals].map(([itemId, quantity]) => ({ itemId, quantity: quantityFromMicros(quantity) }));
    const batchId = batchKey ? new Types.ObjectId(createHash("sha256").update(`${restaurantId}:${batchKey}`).digest("hex").slice(0, 24)) : undefined;
    if (batchId) {
      // Save the plan before any stock movement. Concurrent retries all read the winning snapshot.
      const batch = await InventoryDeductionBatch.findOneAndUpdate(
        { _id: batchId }, { $setOnInsert: { restaurantId, orderId, ingredients } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      ingredients = batch.ingredients;
    }
    for (const { itemId, quantity } of ingredients) {
      const deductionKey = batchId ? createHash("sha256").update(`${batchId.toString()}:${itemId}`).digest("hex").slice(0, 24) : undefined;
      const updated = await InventoryItem.findOneAndUpdate(
        { _id: itemId, restaurantId, ...(deductionKey ? { processedDeductionKeys: { $ne: deductionKey } } : {}) },
        stockMovementPipeline(-recipeRequirementMicros(quantity, 1), deductionKey),
        { returnDocument: "after", updatePipeline: true },
      );
      if (updated) stockChanged = true;
      if (!updated && (!deductionKey || !await InventoryItem.exists({ _id: itemId, restaurantId, processedDeductionKeys: deductionKey }))) continue;
      if (updated && updated.currentStock < 0) console.error(`[inventory] ${updated.name}: ${updated.currentStock} ${updated.unit} remaining after order ${orderId}.`);
      const transaction = { restaurantId, itemId, type: "deduction" as const, quantityDelta: -quantity, staffId, relatedOrderId: orderId };
      if (deductionKey) {
        // If stock was committed but the process stopped before ledger insertion, replay repairs the ledger.
        await InventoryTransaction.updateOne({ _id: new Types.ObjectId(deductionKey) }, { $setOnInsert: transaction }, { upsert: true });
      } else {
        await InventoryTransaction.create(transaction);
      }
    }
  } catch (error) {
    if (batchKey) throw error; // QR request can recover by replaying its saved batch.
    console.error(`[inventory] Ingredient stock deduction failed for order ${orderId} (restaurant ${restaurantId}).`, error);
  } finally {
    if (stockChanged) emitToRestaurant(restaurantId, "inventory:changed", {});
  }
}
