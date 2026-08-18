import type { HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import {
  WebsiteContent,
  MAX_GALLERY_IMAGES,
  type WebsiteContentDocument,
} from "../models/website-content.model";

export interface WebsiteContentDto {
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
  createdAt: Date;
  updatedAt: Date;
}

function toDto(doc: HydratedDocument<WebsiteContentDocument>): WebsiteContentDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    heroImageUrl: doc.heroImageUrl,
    heroHeadline: doc.heroHeadline,
    aboutText: doc.aboutText,
    galleryImageUrls: doc.galleryImageUrls,
    contactPhone: doc.contactPhone,
    contactEmail: doc.contactEmail,
    mapEmbedUrl: doc.mapEmbedUrl,
    isPublished: doc.isPublished,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * One content doc per restaurant, created lazily on first GET/PATCH rather
 * than at restaurant-provisioning time — keeps this module independent of
 * the seed/onboarding script. `restaurantId` carries the model's `unique`
 * index, so if two requests race to create the first doc for a restaurant,
 * the loser's `create` throws a duplicate-key error; that's caught here and
 * retried as a plain find so the caller never sees the race.
 */
async function findOrCreateContent(
  restaurantId: string,
): Promise<HydratedDocument<WebsiteContentDocument>> {
  const existing = await WebsiteContent.findOne({ restaurantId });
  if (existing) return existing;

  try {
    return await WebsiteContent.create({ restaurantId, galleryImageUrls: [], isPublished: false });
  } catch (error) {
    const afterRace = await WebsiteContent.findOne({ restaurantId });
    if (afterRace) return afterRace;
    throw error;
  }
}

export async function getWebsiteContent(restaurantId: string): Promise<WebsiteContentDto> {
  const content = await findOrCreateContent(restaurantId);
  return toDto(content);
}

export interface UpdateWebsiteContentInput {
  heroImageUrl?: string;
  heroHeadline?: string;
  aboutText?: string;
  galleryImageUrls?: string[];
  contactPhone?: string;
  contactEmail?: string;
  mapEmbedUrl?: string;
  isPublished?: boolean;
}

export async function updateWebsiteContent(
  restaurantId: string,
  input: UpdateWebsiteContentInput,
): Promise<WebsiteContentDto> {
  const content = await findOrCreateContent(restaurantId);

  if (input.heroImageUrl !== undefined) content.heroImageUrl = input.heroImageUrl || undefined;
  if (input.heroHeadline !== undefined) content.heroHeadline = input.heroHeadline || undefined;
  if (input.aboutText !== undefined) content.aboutText = input.aboutText || undefined;
  if (input.galleryImageUrls !== undefined) content.galleryImageUrls = input.galleryImageUrls;
  if (input.contactPhone !== undefined) content.contactPhone = input.contactPhone || undefined;
  if (input.contactEmail !== undefined) content.contactEmail = input.contactEmail || undefined;
  if (input.mapEmbedUrl !== undefined) content.mapEmbedUrl = input.mapEmbedUrl || undefined;
  if (input.isPublished !== undefined) content.isPublished = input.isPublished;

  await content.save();
  return toDto(content);
}

/**
 * `POST /api/website/media` — accepts a URL string to append to the
 * gallery. This stands in for a real multipart upload to S3/cloud storage
 * (deferred, same pattern as `MenuItem.imageUrl` / `Restaurant.logoUrl` —
 * see those fields' doc comments and `docs/07-handover.md`); swap this for
 * a real upload handler later without changing the response shape.
 */
export async function addGalleryImage(
  restaurantId: string,
  imageUrl: string,
): Promise<WebsiteContentDto> {
  const content = await findOrCreateContent(restaurantId);

  if (content.galleryImageUrls.length >= MAX_GALLERY_IMAGES) {
    throw new AppError(
      `Gallery can hold at most ${MAX_GALLERY_IMAGES} images. Remove one before adding another.`,
      400,
      "GALLERY_FULL",
    );
  }

  content.galleryImageUrls.push(imageUrl);
  await content.save();
  return toDto(content);
}
