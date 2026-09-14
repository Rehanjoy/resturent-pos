import { randomBytes } from "crypto";
import { Schema, model, type Types } from "mongoose";

export const TABLE_SHAPES = ["round", "square"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

export const TABLE_STATUSES = [
  "free",
  "occupied",
  "reserved",
  "needs_cleaning",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export interface TableDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  areaId: Types.ObjectId;
  name: string;
  seatingCapacity: number;
  shape: TableShape;
  status: TableStatus;
  qrToken: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A physical table on the floor. `qrToken` is generated at creation time so
 * the field is the unguessable table component used to generate one QR per
 * numbered chair for the public dining flow (PRD §3.6).
 */
const tableSchema = new Schema<TableDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true },
    name: { type: String, required: true, trim: true },
    seatingCapacity: { type: Number, required: true, min: 1 },
    shape: { type: String, enum: TABLE_SHAPES, required: true },
    status: {
      type: String,
      enum: TABLE_STATUSES,
      required: true,
      default: "free",
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      default: () => randomBytes(16).toString("hex"),
    },
  },
  { timestamps: true },
);

// Powers the color-coded status grid query (PRD §5.4 required compound
// index) and the high-frequency "how many tables of each status right now"
// read that drives both the Table Grid and the Dashboard's live widget.
tableSchema.index({ restaurantId: 1, status: 1 });
tableSchema.index({ restaurantId: 1, areaId: 1 });

export const Table = model<TableDocument>("Table", tableSchema);
