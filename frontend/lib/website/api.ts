import { api } from "@/lib/api";
import type { WebsiteContent } from "./types";

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

/**
 * Admin editor API (authenticated, `/admin/website`) — goes through the
 * shared `lib/api.ts` client like every other admin screen. The separate,
 * unauthenticated public-site read lives in `lib/website/public-api.ts`,
 * not here — see that file's doc comment for why they can't share a
 * client.
 */
export const websiteApi = {
  getContent: () => api.get<{ content: WebsiteContent }>("/api/website/content"),

  updateContent: (input: UpdateWebsiteContentInput) =>
    api.patch<{ content: WebsiteContent }>("/api/website/content", input),

  addGalleryImage: (imageUrl: string) =>
    api.post<{ content: WebsiteContent }>("/api/website/media", { imageUrl }),
};
