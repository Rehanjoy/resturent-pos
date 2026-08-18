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
export async function deductInventoryForSentItems(
  restaurantId: string,
  staffId: string,
  orderId: string,
  items: SentItemForDeduction[],
): Promise<void> {
  try {
    const menuItemIds = [...new Set(items.map((item) => item.menuItemId))].filter((id) =>
      Types.ObjectId.isValid(id),
    );
    if (menuItemIds.length === 0) return;

    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, restaurantId })
      .select("ingredientMapping")
      .lean();
    const mappingByMenuItemId = new Map(
      menuItems.map((menuItem) => [menuItem._id.toString(), menuItem.ingredientMapping ?? []]),
    );

    for (const item of items) {
      const mapping = mappingByMenuItemId.get(item.menuItemId);
      if (!mapping || mapping.length === 0) continue;

      for (const ingredient of mapping) {
        const inventoryItemId = ingredient.inventoryItemId.toString();
        if (!Types.ObjectId.isValid(inventoryItemId)) continue;

        const quantityToDeduct = ingredient.quantityPerUnit * item.qty;
        if (!(quantityToDeduct > 0)) continue;

        // Atomic per-document decrement — see judgment call #2 above. No
        // floor at zero: negative stock is an allowed, visible state (call
        // #3), not an error condition.
        const updated = await InventoryItem.findOneAndUpdate(
          { _id: inventoryItemId, restaurantId },
          { $inc: { currentStock: -quantityToDeduct } },
          { new: true },
        );
        if (!updated) continue; // mapped ingredient no longer exists — nothing to deduct against

        if (updated.currentStock < 0) {
          console.error(
            `[inventory] "${updated.name}" (${updated._id.toString()}) went negative — ` +
              `${updated.currentStock} ${updated.unit} remaining after order ${orderId} ` +
              `(restaurant ${restaurantId}) was sent to the kitchen. Order was not blocked.`,
          );
        }

        await InventoryTransaction.create({
          restaurantId,
          itemId: updated._id,
          type: "deduction",
          quantityDelta: -quantityToDeduct,
          staffId,
          relatedOrderId: orderId,
        });
      }
    }
  } catch (error) {
    console.error(
      `[inventory] Ingredient stock deduction failed for order ${orderId} ` +
        `(restaurant ${restaurantId}) — the order was still sent to the kitchen.`,
      error,
    );
  }
}
