import type { AudienceSelector, Contact } from "./types";

/**
 * Client-side mirror of `backend/src/services/marketing-campaign.service.ts`
 * `resolveAudience`'s "all"/"tags" branches — used by `NewCampaignModal` to
 * show a recipient-count estimate before sending. Always excludes
 * `optedIn: false` contacts, matching the backend exactly. Not used for the
 * `contactIds` audience type — that one already only offers opted-in
 * contacts as selectable rows, so the selection count itself is the
 * estimate (see the modal).
 */
export function filterContactsForAudience(
  contacts: Contact[],
  audience: Extract<AudienceSelector, { type: "all" | "tags" }>,
): Contact[] {
  const eligible = contacts.filter((contact) => contact.optedIn);
  if (audience.type === "all") return eligible;
  if (audience.tags.length === 0) return [];
  return eligible.filter((contact) => contact.tags.some((tag) => audience.tags.includes(tag)));
}
