import { Schema, model, type Types } from "mongoose";

/** Gallery cap — a sane upper bound so an unbounded array can't be pushed
 * into the document forever (PRD §3.13 "gallery images"). Enforced both
 * here (schema-level, catches any writer) and again in
 * `website.validators.ts` (edge validation, so a bad request never reaches
 * the service layer at all). */
export const MAX_GALLERY_IMAGES = 20;

export interface WebsiteContentDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  heroImageUrl?: string;
  heroHeadline?: string;
  aboutText?: string;
  galleryImageUrls: string[];
  contactPhone?: string;
  contactEmail?: string;
  mapEmbedUrl?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One content doc per restaurant (`restaurantId` is `unique`) — the
 * editable half of the Website Builder module (PRD §3.13). Restaurant
 * identity fields that already exist elsewhere (`Restaurant.name`,
 * `Restaurant.address`, `Restaurant.gstNumber`) are deliberately NOT
 * duplicated here; the public endpoint composes them at read time (see
 * `public-website.service.ts`).
 *
 * `isPublished` gates the public site entirely — an unpublished site 404s
 * for anonymous visitors (see `public-website.service.ts`
 * `getPublicWebsite`), so a restaurant can build out its content before
 * going live.
 */
const websiteContentSchema = new Schema<WebsiteContentDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
    },
    // TODO: real upload (S3/cloud storage) later — same deferred pattern as
    // `MenuItem.imageUrl` / `Restaurant.logoUrl`. Admin pastes a hosted
    // image URL for now; `POST /api/website/media` just appends a URL
    // string to `galleryImageUrls` rather than accepting a file upload.
    heroImageUrl: { type: String, trim: true },
    heroHeadline: { type: String, trim: true },
    aboutText: { type: String, trim: true },
    galleryImageUrls: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= MAX_GALLERY_IMAGES,
        message: `Gallery can hold at most ${MAX_GALLERY_IMAGES} images.`,
      },
    },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    // An iframe embed URL (e.g. a Google Maps "Embed a map" link), not a
    // plain address/lat-lng pair — rendered directly in an <iframe> on the
    // public page (`app/(website)/[slug]/page.tsx`).
    mapEmbedUrl: { type: String, trim: true },
    isPublished: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export const WebsiteContent = model<WebsiteContentDocument>(
  "WebsiteContent",
  websiteContentSchema,
);
