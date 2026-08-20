import type { Types } from "mongoose";
import { AppError } from "../utils/app-error";
import { Restaurant, type RestaurantAddress } from "../models/restaurant.model";
import { WebsiteContent } from "../models/website-content.model";
import { Category } from "../models/category.model";
import { MenuItem, type MenuItemType, type SpiceLevel } from "../models/menu-item.model";

export interface PublicMenuItemDto {
  id: string;
  name: string;
  description?: string;
  /** Integer paise — see `frontend/lib/format.ts` `formatMoney`. */
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
}

export interface PublicMenuCategoryDto {
  id: string;
  name: string;
  items: PublicMenuItemDto[];
}

export interface PublicWebsiteDto {
  restaurant: {
    name: string;
    address?: RestaurantAddress;
    gstNumber?: string;
  };
  content: {
    heroImageUrl?: string;
    heroHeadline?: string;
    aboutText?: string;
    galleryImageUrls: string[];
    contactPhone?: string;
    contactEmail?: string;
    mapEmbedUrl?: string;
  };
  menu: PublicMenuCategoryDto[];
}

/**
 * Builds the public-safe menu shape (available items only, no recipe/cost
 * data) from live `Category`/`MenuItem` data for one restaurant. Extracted
 * out of `getPublicWebsite` so the Marketing module's AI auto-reply
 * (`ai-config.service.ts` `buildRestaurantContext`) can reuse the exact
 * same "what can the bot see" shape/logic instead of re-querying raw
 * `MenuItem` documents (and, e.g., accidentally leaking `ingredientMapping`
 * cost data into a customer-facing chat reply).
 */
export async function buildPublicMenu(
  restaurantId: Types.ObjectId | string,
): Promise<PublicMenuCategoryDto[]> {
  const [categories, menuItems] = await Promise.all([
    Category.find({ restaurantId }).sort({ displayOrder: 1, name: 1 }),
    MenuItem.find({ restaurantId, isAvailable: true }).sort({ name: 1 }),
  ]);

  const itemsByCategoryId = new Map<string, PublicMenuItemDto[]>();
  for (const item of menuItems) {
    const key = item.categoryId.toString();
    const list = itemsByCategoryId.get(key) ?? [];
    list.push({
      id: item._id.toString(),
      name: item.name,
      description: item.description,
      price: item.price,
      type: item.type,
      spiceLevel: item.spiceLevel,
      imageUrl: item.imageUrl,
    });
    itemsByCategoryId.set(key, list);
  }

  return categories
    .map((category) => ({
      id: category._id.toString(),
      name: category.name,
      items: itemsByCategoryId.get(category._id.toString()) ?? [],
    }))
    // Skip categories with no currently-available dish rather than showing
    // an empty section.
    .filter((category) => category.items.length > 0);
}

/**
 * Public, unauthenticated read for the customer-facing website (PRD
 * §3.13). `restaurantId` is resolved internally from the slug in the URL —
 * this route never accepts a client-supplied restaurant id (there isn't
 * one on the request at all), matching the "tenant isolation" rule for
 * every other module but applied here via slug lookup instead of a JWT
 * claim, since there's no session to read one from.
 *
 * Returns 404 both when the restaurant doesn't exist AND when its website
 * isn't published — the two cases are deliberately indistinguishable to an
 * anonymous caller so a bad/guessed slug can't be used to fingerprint
 * which restaurants exist in the system but haven't launched their site
 * yet.
 *
 * Only public-safe restaurant fields are returned (name/address/GST
 * number, per the build brief) — never staff, session, or financial data.
 * The menu is built from live `Category`/`MenuItem` data but re-shaped
 * into a narrow public DTO that omits `ingredientMapping` (recipe/cost
 * data) entirely and filters to `isAvailable: true` items only, so an 86'd
 * dish or ingredient costs never reach an anonymous browser.
 */
export async function getPublicWebsite(restaurantSlug: string): Promise<PublicWebsiteDto> {
  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  if (!restaurant) {
    throw new AppError("This restaurant's website could not be found.", 404, "NOT_FOUND");
  }

  const content = await WebsiteContent.findOne({
    restaurantId: restaurant._id,
    isPublished: true,
  });
  if (!content) {
    throw new AppError("This restaurant's website could not be found.", 404, "NOT_FOUND");
  }

  const menu = await buildPublicMenu(restaurant._id);

  return {
    restaurant: {
      name: restaurant.name,
      address: restaurant.address,
      gstNumber: restaurant.gstNumber,
    },
    content: {
      heroImageUrl: content.heroImageUrl,
      heroHeadline: content.heroHeadline,
      aboutText: content.aboutText,
      galleryImageUrls: content.galleryImageUrls,
      contactPhone: content.contactPhone,
      contactEmail: content.contactEmail,
      mapEmbedUrl: content.mapEmbedUrl,
    },
    menu,
  };
}
