import { Types } from "mongoose";
import { Restaurant, type RestaurantDocument } from "../../src/models/restaurant.model";
import { User, type UserRole } from "../../src/models/user.model";
import { Area } from "../../src/models/area.model";
import { Table } from "../../src/models/table.model";
import { Category } from "../../src/models/category.model";
import { MenuItem } from "../../src/models/menu-item.model";
import { hashPassword } from "../../src/utils/password";
import { signAccessToken } from "../../src/utils/jwt";

/** A restaurant with a two-slab CGST+SGST tax config (9% + 9% = 18%,
 * matching real Indian restaurant GST) and the default 15%-threshold
 * discount policy, so tests exercise the same tax math a real deployment
 * would. */
export async function createTestRestaurant(
  overrides: Partial<{ taxConfig: RestaurantDocument["taxConfig"] }> = {},
) {
  return Restaurant.create({
    name: "Test Restaurant",
    slug: `test-restaurant-${new Types.ObjectId().toString()}`,
    taxConfig: overrides.taxConfig ?? [
      { name: "CGST", ratePercent: 9, type: "CGST" },
      { name: "SGST", ratePercent: 9, type: "SGST" },
    ],
    settings: {
      discountApprovalThreshold: { type: "percent", value: 15 },
      enabledPaymentModes: ["cash", "card", "upi"],
    },
  });
}

export async function createTestStaff(
  restaurantId: string,
  role: UserRole,
  overrides: Partial<{ email: string; password: string; isActive: boolean }> = {},
) {
  const password = overrides.password ?? "TestPass123!";
  const user = await User.create({
    restaurantId,
    name: `Test ${role}`,
    email: overrides.email ?? `${role}-${new Types.ObjectId().toString()}@test.saffron.dev`,
    passwordHash: await hashPassword(password),
    role,
    isActive: overrides.isActive ?? true,
  });
  return { user, password };
}

/** Issues a real access token for a staff fixture, for tests that call
 * service functions directly (bypassing the login endpoint's own coverage,
 * which `tests/rbac.test.ts` exercises separately end-to-end). */
export function tokenFor(user: { _id: Types.ObjectId; restaurantId: Types.ObjectId; role: UserRole }) {
  return signAccessToken({
    userId: user._id.toString(),
    restaurantId: user.restaurantId.toString(),
    role: user.role,
  });
}

/** Reuses one "Test Category" per restaurant for the same reason as
 * `createTestTable`'s "Test Area" reuse — Category also has a unique
 * `{restaurantId, name}` index. */
export async function createTestMenuItem(
  restaurantId: string,
  overrides: Partial<{ price: number; name: string }> = {},
) {
  const category =
    (await Category.findOne({ restaurantId, name: "Test Category" })) ??
    (await Category.create({ restaurantId, name: "Test Category", displayOrder: 0 }));
  return MenuItem.create({
    restaurantId,
    categoryId: category._id,
    name: overrides.name ?? "Test Dish",
    price: overrides.price ?? 10000, // ₹100.00 in paise
    type: "veg",
    isAvailable: true,
    ingredientMapping: [],
  });
}

/** Reuses one "Test Area" per restaurant (Area has a unique `{restaurantId,
 * name}` index) so a test can create several tables for the same
 * restaurant without a duplicate-key error. */
export async function createTestTable(restaurantId: string) {
  const area =
    (await Area.findOne({ restaurantId, name: "Test Area" })) ??
    (await Area.create({ restaurantId, name: "Test Area", displayOrder: 0 }));
  return Table.create({
    restaurantId,
    areaId: area._id,
    name: `T${new Types.ObjectId().toString().slice(-4)}`,
    seatingCapacity: 4,
    shape: "square",
    status: "free",
  });
}
