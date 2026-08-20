import type { HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { encrypt } from "../utils/encryption";
import { verifyPhoneNumber } from "../lib/whatsapp/meta-api";
import { WhatsappConfig, type WhatsappConfigDocument } from "../models/whatsapp-config.model";

export interface WhatsappConfigDto {
  id: string;
  restaurantId: string;
  phoneNumberId: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isConnected: boolean;
  connectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Deliberately never reads or returns `accessTokenEncrypted` — the field
 * stays unselected (see the model's `select: false`), so there is no
 * accidental leak path through this DTO. */
function toDto(doc: HydratedDocument<WhatsappConfigDocument>): WhatsappConfigDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    phoneNumberId: doc.phoneNumberId,
    wabaId: doc.wabaId,
    displayPhoneNumber: doc.displayPhoneNumber,
    verifiedName: doc.verifiedName,
    isConnected: doc.isConnected,
    connectedAt: doc.connectedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** `null` (not a lazily-created empty doc, unlike Website Builder's
 * content doc) — "not connected yet" is a real, meaningful state the Setup
 * screen renders differently, not just an empty form. */
export async function getWhatsappConfig(restaurantId: string): Promise<WhatsappConfigDto | null> {
  const config = await WhatsappConfig.findOne({ restaurantId });
  return config ? toDto(config) : null;
}

export interface SaveWhatsappConfigInput {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
}

/**
 * Validates the phoneNumberId+accessToken pair against Meta's Graph API
 * before saving anything — a restaurant never ends up with a config that
 * *looks* connected but silently fails on first send. On success, the
 * access token is AES-256-GCM encrypted (`utils/encryption.ts`) and
 * `displayPhoneNumber`/`verifiedName` are populated from Meta's own
 * response, never from client input.
 */
export async function saveWhatsappConfig(
  restaurantId: string,
  input: SaveWhatsappConfigInput,
): Promise<WhatsappConfigDto> {
  let phoneInfo;
  try {
    phoneInfo = await verifyPhoneNumber({
      phoneNumberId: input.phoneNumberId,
      accessToken: input.accessToken,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify this WhatsApp number with Meta.";
    throw new AppError(`Could not connect to WhatsApp: ${message}`, 400, "WHATSAPP_VERIFICATION_FAILED");
  }

  const config = await WhatsappConfig.findOneAndUpdate(
    { restaurantId },
    {
      $set: {
        restaurantId,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        accessTokenEncrypted: encrypt(input.accessToken),
        displayPhoneNumber: phoneInfo.displayPhoneNumber,
        verifiedName: phoneInfo.verifiedName,
        isConnected: true,
        connectedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return toDto(config);
}
