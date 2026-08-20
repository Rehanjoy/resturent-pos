/**
 * Meta WhatsApp Business Cloud API client — direct Graph API calls, not a
 * third-party CRM. Part 1 only needs `verifyPhoneNumber` (confirms a Phone
 * Number ID + access token pair is valid, so the Setup screen can show
 * "Connected as [Verified Business Name]" immediately instead of finding
 * out it's broken on first send). Sending/messaging functions
 * (`sendTemplateMessage` etc.) are Part 2 scope, not added here.
 *
 * Re-implemented for this codebase's own conventions from the reference at
 * https://github.com/ArnasDon/wacrm (MIT licensed) — same Graph API
 * version/endpoint shape and error-unwrapping behavior, but named-args
 * object parameters (a typo surfaces as a TypeScript error instead of a
 * runtime request to the wrong field) and `AppError`/service-layer
 * integration deliberately left to the caller (`whatsapp-config.service.ts`)
 * rather than baked in here — this module's only job is talking to Meta.
 */

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaPhoneInfo {
  id: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  qualityRating?: string;
}

interface RawMetaPhoneInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
}

interface MetaErrorResponseBody {
  error?: { message?: string; code?: number; type?: string };
}

async function readMetaErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as MetaErrorResponseBody;
    return body.error?.message ?? fallback;
  } catch {
    // Response body wasn't JSON (or was empty) — keep the fallback rather
    // than throwing a second, more confusing error out of this handler.
    return fallback;
  }
}

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Fetches a WhatsApp phone number's public metadata from Meta's Graph API
 * — the read used to confirm a Phone-Number-ID + access-token pair is
 * genuinely valid before the Setup screen saves it as "connected".
 */
export async function verifyPhoneNumber(args: VerifyPhoneNumberArgs): Promise<MetaPhoneInfo> {
  const { phoneNumberId, accessToken } = args;
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const message = await readMetaErrorMessage(response, `Meta API error (HTTP ${response.status}).`);
    throw new Error(message);
  }

  const body = (await response.json()) as RawMetaPhoneInfo;
  return {
    id: body.id,
    displayPhoneNumber: body.display_phone_number,
    verifiedName: body.verified_name,
    qualityRating: body.quality_rating,
  };
}
