import type { PublicWebsite } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

/** Thrown for both "no such restaurant" and "site not published" — the
 * backend deliberately returns the same 404 for both (see
 * `backend/src/services/public-website.service.ts`), so the frontend
 * can't and shouldn't distinguish them either. */
export class PublicWebsiteNotFoundError extends Error {}

/**
 * Dedicated fetch for the single public, unauthenticated endpoint the
 * public restaurant site page calls (`GET /api/public/:restaurantSlug/website`).
 * Deliberately NOT `lib/api.ts` — that client attaches an `Authorization`
 * header whenever an access token happens to be in memory and transparently
 * retries through the refresh-cookie flow on a 401, both of which assume a
 * logged-in staff session. A page real, anonymous customers load with no
 * session at all should never send credentials or trigger a refresh
 * attempt, so this stays a plain, minimal `fetch` instead.
 */
export async function getPublicWebsite(restaurantSlug: string): Promise<PublicWebsite> {
  const response = await fetch(
    `${API_BASE_URL}/api/public/${encodeURIComponent(restaurantSlug)}/website`,
    // Always fetch fresh — this is server-rendered per request already
    // (no ISR configured yet), and a stale "not published" vs "published"
    // read would be a confusing bug for a restaurant that just went live.
    { cache: "no-store" },
  );

  if (response.status === 404) {
    throw new PublicWebsiteNotFoundError("This restaurant's website could not be found.");
  }
  if (!response.ok) {
    throw new Error("Could not load this restaurant's website. Please try again.");
  }

  const body = (await response.json()) as { website: PublicWebsite };
  return body.website;
}
