import { Schema, model, type Types } from "mongoose";

export interface AreaDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seating area (AC Indoor, Terrace, Garden, etc. — PRD §3.5). Tables belong
 * to exactly one area via `Table.areaId`. Name is unique per restaurant so
 * the area tab strip on the Table Grid never shows duplicate labels.
 */
const areaSchema = new Schema<AreaDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

areaSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
areaSchema.index({ restaurantId: 1, displayOrder: 1 });

export const Area = model<AreaDocument>("Area", areaSchema);
