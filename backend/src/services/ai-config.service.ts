import type { HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { encrypt } from "../utils/encryption";
import { Restaurant } from "../models/restaurant.model";
import { buildPublicMenu } from "./public-website.service";
import { AiConfig, type AiConfigDocument } from "../models/ai-config.model";

export interface AiConfigDto {
  id: string;
  restaurantId: string;
  /** Never the key itself, encrypted or otherwise — same
   * never-return-the-secret convention as `whatsapp-config.service.ts`
   * `WhatsappConfigDto`. Just enough for the Setup screen to render
   * "a key is saved" vs. "no key saved yet". */
  hasGeminiApiKey: boolean;
  systemPromptExtra?: string;
  autoReplyEnabled: boolean;
  maxAutoRepliesPerConversation: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(doc: HydratedDocument<AiConfigDocument>): AiConfigDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    hasGeminiApiKey: !!doc.geminiApiKeyEncrypted,
    systemPromptExtra: doc.systemPromptExtra,
    autoReplyEnabled: doc.autoReplyEnabled,
    maxAutoRepliesPerConversation: doc.maxAutoRepliesPerConversation,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** `null` (not a lazily-created default doc) — "AI hasn't been configured
 * yet" is a real state the Setup screen renders differently (no key, auto-
 * reply off), matching `whatsapp-config.service.ts` `getWhatsappConfig`'s
 * same reasoning. Selects the encrypted key field only to compute
 * `hasGeminiApiKey` in `toDto` — the plaintext/ciphertext itself never
 * leaves this function. */
export async function getAiConfig(restaurantId: string): Promise<AiConfigDto | null> {
  const config = await AiConfig.findOne({ restaurantId }).select("+geminiApiKeyEncrypted");
  return config ? toDto(config) : null;
}

export interface SaveAiConfigInput {
  /** Omitted/empty = leave the previously saved key untouched — the Setup
   * form never round-trips the real key back to the client, so "the field
   * was left blank" must mean "no change", not "clear the key". */
  geminiApiKey?: string;
  systemPromptExtra?: string;
  autoReplyEnabled?: boolean;
  maxAutoRepliesPerConversation?: number;
}

/**
 * Creates or updates the restaurant's AI config (upsert, mirroring
 * `whatsapp-config.service.ts` `saveWhatsappConfig`'s one-document-per-
 * restaurant pattern). Refuses to enable auto-reply unless a Gemini key is
 * on file (either provided in this same call or already saved) — an
 * Owner can never end up with `autoReplyEnabled: true` and no key, which
 * would otherwise fail silently (as a handoff) on every single inbound
 * message instead of failing loudly here, at the moment of the mistake.
 */
export async function saveAiConfig(restaurantId: string, input: SaveAiConfigInput): Promise<AiConfigDto> {
  const existing = await AiConfig.findOne({ restaurantId }).select("+geminiApiKeyEncrypted");

  const willHaveKey = !!(input.geminiApiKey || existing?.geminiApiKeyEncrypted);
  const nextAutoReplyEnabled = input.autoReplyEnabled ?? existing?.autoReplyEnabled ?? false;
  if (nextAutoReplyEnabled && !willHaveKey) {
    throw new AppError(
      "Add a Gemini API key before turning on auto-reply.",
      400,
      "GEMINI_KEY_REQUIRED",
    );
  }

  const update: Record<string, unknown> = { restaurantId };
  if (input.geminiApiKey) update.geminiApiKeyEncrypted = encrypt(input.geminiApiKey);
  if (input.systemPromptExtra !== undefined) {
    update.systemPromptExtra = input.systemPromptExtra || undefined;
  }
  if (input.autoReplyEnabled !== undefined) update.autoReplyEnabled = input.autoReplyEnabled;
  if (input.maxAutoRepliesPerConversation !== undefined) {
    update.maxAutoRepliesPerConversation = input.maxAutoRepliesPerConversation;
  }

  const config = await AiConfig.findOneAndUpdate(
    { restaurantId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).select("+geminiApiKeyEncrypted");

  return toDto(config as HydratedDocument<AiConfigDocument>);
}

function formatAddress(address?: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string | null {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
    .filter((part): part is string => !!part && part.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Builds the text block passed to `lib/ai/gemini.ts` `generateReply` as its
 * "restaurant and menu information" system-prompt context —
 * `whatsapp-webhook.service.ts` calls this on every AI-eligible inbound
 * message. Restaurant name/address come straight from `Restaurant`; the
 * menu reuses `public-website.service.ts` `buildPublicMenu` (the exact
 * same public-safe, available-items-only shape the customer-facing website
 * shows, so the bot never mentions an 86'd dish or leaks recipe/cost data
 * that shape already excludes) rather than querying `MenuItem` again here.
 * `systemPromptExtra` (owner-authored notes) is appended at the end, never
 * replacing any of the generated content above it.
 */
export async function buildRestaurantContext(
  restaurantId: string,
  systemPromptExtra?: string,
): Promise<string> {
  const [restaurant, menu] = await Promise.all([
    Restaurant.findById(restaurantId),
    buildPublicMenu(restaurantId),
  ]);

  const lines: string[] = [];
  lines.push(`Restaurant name: ${restaurant?.name ?? "this restaurant"}`);
  const address = formatAddress(restaurant?.address);
  if (address) lines.push(`Address: ${address}`);

  lines.push("");
  lines.push("Menu (only these dishes are currently available — never mention anything not listed here):");
  if (menu.length === 0) {
    lines.push("(No menu items are currently marked available.)");
  } else {
    for (const category of menu) {
      lines.push(`${category.name}:`);
      for (const item of category.items) {
        const price = (item.price / 100).toFixed(2);
        const details = [item.type, item.spiceLevel].filter(Boolean).join(", ");
        const description = item.description ? ` — ${item.description}` : "";
        lines.push(`- ${item.name} (${details}), ₹${price}${description}`);
      }
    }
  }

  if (systemPromptExtra && systemPromptExtra.trim().length > 0) {
    lines.push("");
    lines.push("Additional notes from the restaurant owner (follow these too):");
    lines.push(systemPromptExtra.trim());
  }

  return lines.join("\n");
}
