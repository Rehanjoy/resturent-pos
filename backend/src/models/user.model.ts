import { Schema, model, type Types } from "mongoose";

export const USER_ROLES = [
  "owner",
  "manager",
  "cashier",
  "server",
  "chef",
  "inventory_manager",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  pinHash?: string;
  isActive: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Staff account. `passwordHash`, `pinHash`, and `twoFactorSecret` are all
 * `select: false` — they never come back on a normal `find`/`findById` and
 * must be opted into explicitly with `.select("+passwordHash")` etc. only
 * where the auth service actually needs to compare them. Never return any
 * of these three fields in an API response.
 */
const userSchema = new Schema<UserDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
    pinHash: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    mustResetPassword: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Email is unique per restaurant, not globally — matches the multi-tenant-
// ready data model (PRD §5.4) even though Phase 1 only ever seeds one
// restaurant per deployment.
userSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
userSchema.index({ restaurantId: 1, role: 1 });

export const User = model<UserDocument>("User", userSchema);
