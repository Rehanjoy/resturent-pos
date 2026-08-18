import { z } from "zod";
import { MAX_GALLERY_IMAGES } from "../models/website-content.model";

// Optional URL fields accept either a valid URL or an empty string (clears
// the field) — same convention as `settings.validators.ts` `logoUrl`.
const optionalUrlSchema = z.string().trim().url("Enter a valid URL.").max(1000).optional().or(z.literal(""));

export const updateWebsiteContentSchema = z
  .object({
    heroImageUrl: optionalUrlSchema,
    heroHeadline: z.string().trim().max(160).optional().or(z.literal("")),
    aboutText: z.string().trim().max(4000).optional().or(z.literal("")),
    galleryImageUrls: z
      .array(z.string().trim().url("Every gallery image must be a valid URL."))
      .max(MAX_GALLERY_IMAGES, `Gallery can hold at most ${MAX_GALLERY_IMAGES} images.`)
      .optional(),
    contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
    contactEmail: z
      .string()
      .trim()
      .email("Enter a valid email.")
      .max(200)
      .optional()
      .or(z.literal("")),
    mapEmbedUrl: optionalUrlSchema,
    isPublished: z.boolean().optional(),
  })
  .strict();

export const addGalleryImageSchema = z.object({
  imageUrl: z.string().trim().url("Enter a valid image URL.").max(1000),
});

export const restaurantSlugParamsSchema = z.object({
  restaurantSlug: z.string().trim().min(1, "Restaurant is required."),
});
