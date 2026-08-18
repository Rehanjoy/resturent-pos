/** Mirrors `backend/src/services/website.service.ts` `WebsiteContentDto` —
 * the admin-editable half of the Website Builder module (PRD §3.13). */
export interface WebsiteContent {
  id: string;
  restaurantId: string;
  heroImageUrl?: string;
  heroHeadline?: string;
  aboutText?: string;
  galleryImageUrls: string[];
  contactPhone?: string;
  contactEmail?: string;
  mapEmbedUrl?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicMenuItemType = "veg" | "non-veg" | "egg";
export type PublicSpiceLevel = "none" | "mild" | "medium" | "spicy";

/** Mirrors `backend/src/services/public-website.service.ts`
 * `PublicMenuItemDto` — deliberately narrower than the admin `MenuItem`
 * type (no `ingredientMapping`, no cost data). */
export interface PublicMenuItem {
  id: string;
  name: string;
  description?: string;
  /** Integer paise — see `lib/format.ts` `formatMoney`. */
  price: number;
  type: PublicMenuItemType;
  spiceLevel?: PublicSpiceLevel;
  imageUrl?: string;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

export interface PublicRestaurantAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/** Mirrors `backend/src/services/public-website.service.ts`
 * `PublicWebsiteDto` — the full payload the public site page renders. */
export interface PublicWebsite {
  restaurant: {
    name: string;
    address?: PublicRestaurantAddress;
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
  menu: PublicMenuCategory[];
}
