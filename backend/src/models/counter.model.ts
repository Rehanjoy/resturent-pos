import { Schema, model, type Types } from "mongoose";

export interface CounterDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  seq: number;
}

/**
 * Generic atomic per-restaurant sequence generator, currently used only for
 * `invoiceNumber` (PRD §7 "sequential, non-editable invoice numbering").
 * `findOneAndUpdate` with `$inc` is atomic at the single-document level in
 * MongoDB even without a multi-document transaction/replica set — this is
 * what actually guarantees two concurrent "settle bill" requests for the
 * same restaurant can never be handed the same number (the exact race
 * condition PRD §4 calls out), without requiring the deployment to run
 * MongoDB as a replica set just to get transactions.
 */
const counterSchema = new Schema<CounterDocument>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  name: { type: String, required: true, trim: true },
  seq: { type: Number, required: true, default: 0 },
});

counterSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const Counter = model<CounterDocument>("Counter", counterSchema);

/**
 * Atomically increments and returns the next value in the named sequence
 * for this restaurant. Creates the counter document on first use.
 */
export async function getNextSequence(restaurantId: string, name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { restaurantId, name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return counter.seq;
}
