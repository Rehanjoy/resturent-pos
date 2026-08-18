import { Schema, model, type Types } from "mongoose";

export interface CategoryDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Menu category (Starters, Tandoor, Main Course, Biryani, etc. — PRD
 * §3.8). Name is unique per restaurant so the category tab/sidebar on the
 * Menu screen and New Order screen never shows duplicate labels.
 */
const categorySchema = new Schema<CategoryDocument>(
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

categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1, displayOrder: 1 });

export const Category = model<CategoryDocument>("Category", categorySchema);
