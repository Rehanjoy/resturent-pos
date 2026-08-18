import mongoose from "mongoose";
import { connectDatabase } from "../config/db";
import { Restaurant } from "../models/restaurant.model";
import { User } from "../models/user.model";
import { hashPassword } from "../utils/password";

/**
 * Dev/local-only seed script. Self-hosted production deployments will need
 * a proper first-run "install wizard" (out of scope for this build part —
 * the auth module only needs *a* restaurant + owner account to exist to
 * exercise login end-to-end). Run with `npm run seed`.
 */
const RESTAURANT_SLUG = "saffron-demo";
const OWNER_EMAIL = "owner@saffron.dev";
const OWNER_TEMP_PASSWORD = "ChangeMe123!";

async function seed(): Promise<void> {
  await connectDatabase();

  const restaurant = await Restaurant.findOneAndUpdate(
    { slug: RESTAURANT_SLUG },
    {
      $setOnInsert: {
        name: "Saffron Demo Kitchen",
        slug: RESTAURANT_SLUG,
        gstNumber: "27ABCDE1234F1Z5",
        taxConfig: [
          { name: "CGST", ratePercent: 2.5, type: "CGST" },
          { name: "SGST", ratePercent: 2.5, type: "SGST" },
        ],
      },
    },
    { upsert: true, new: true },
  );

  const existingOwner = await User.findOne({
    restaurantId: restaurant._id,
    email: OWNER_EMAIL,
  });

  if (!existingOwner) {
    await User.create({
      restaurantId: restaurant._id,
      name: "Asha Devi",
      email: OWNER_EMAIL,
      passwordHash: await hashPassword(OWNER_TEMP_PASSWORD),
      role: "owner",
      mustResetPassword: true,
      isActive: true,
    });
    console.log(
      `[seed] Created owner account ${OWNER_EMAIL} / ${OWNER_TEMP_PASSWORD} (mustResetPassword=true)`,
    );
  } else {
    console.log(`[seed] Owner account ${OWNER_EMAIL} already exists — skipped.`);
  }

  console.log(`[seed] Restaurant: ${restaurant.name} (${restaurant._id.toString()})`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error("[seed] Failed", error);
  process.exit(1);
});
