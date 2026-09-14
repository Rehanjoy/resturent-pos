import { Types } from "mongoose";
import { InventoryTransaction } from "../models/inventory-transaction.model";

/** Inventory day is 00:00–24:00 Asia/Kolkata (IST), independent of server/browser timezone.
 * This deployment has no restaurant timezone setting. IST has no DST. */
export function inventoryReportingDay(now = new Date()): { start: Date; end: Date } {
  const offset = 330 * 60_000;
  const shifted = new Date(now.getTime() + offset);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offset);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export interface DailyInventoryActivity {
  received: number;
  used: number;
  wasted: number;
  corrected: number;
}

export async function getDailyInventoryActivity(restaurantId: string, now = new Date()): Promise<Map<string, DailyInventoryActivity>> {
  const { start, end } = inventoryReportingDay(now);
  const day = new Date(start.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const rows = await InventoryTransaction.aggregate<{ _id: Types.ObjectId } & DailyInventoryActivity>([
    { $match: { restaurantId: new Types.ObjectId(restaurantId), $or: [{ reportingDay: day }, { reportingDay: { $exists: false }, createdAt: { $gte: start, $lt: end } }] } },
    { $addFields: { deltaMicros: { $round: [{ $multiply: ["$quantityDelta", 1000000] }, 0] } } },
    { $group: {
      _id: "$itemId",
      received: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "restock"] }, { $gt: ["$quantityDelta", 0] }] }, "$deltaMicros", 0] } },
      used: { $sum: { $cond: [{ $in: ["$type", ["deduction", "usage", "usage_correction"]] }, { $multiply: ["$deltaMicros", -1] }, 0] } },
      wasted: { $sum: { $cond: [{ $in: ["$type", ["wastage", "waste_correction"]] }, { $multiply: ["$deltaMicros", -1] }, 0] } },
      corrected: { $sum: { $cond: [{ $eq: ["$type", "adjustment"] }, "$deltaMicros", 0] } },
    } },
  ]);
  return new Map(rows.map(({ _id, ...activity }) => [_id.toString(), { received: activity.received / 1000000, used: activity.used / 1000000, wasted: activity.wasted / 1000000, corrected: activity.corrected / 1000000 }]));
}
