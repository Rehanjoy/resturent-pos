/**
 * Meta WhatsApp Business Cloud API client — direct Graph API calls, not a
 * third-party CRM. Part 1 shipped `verifyPhoneNumber`. Part 2 (this file's
 * current scope) adds `sendTemplateMessage` (broadcast a pre-approved
 * template to one recipient) and `listMessageTemplates` (fetch the WABA's
 * approved template catalog so `message-template.service.ts` can sync a
 * local read-only cache) — both scoped to plain body-text-variable
 * templates (`{{1}}`-style placeholders in the BODY component only).
 * Media headers and button components are real Meta template features but
 * out of scope for this MVP; re-add them here the same way
 * `sendTemplateMessage`'s `components` array is built, if a later part
 * needs them.
 *
 * Re-implemented for this codebase's own conventions from the reference at
 * https://github.com/ArnasDon/wacrm (MIT licensed) — same Graph API
 * version/endpoint shape and error-unwrapping behavior, but named-args
 * object parameters (a typo surfaces as a TypeScript error instead of a
 * runtime request to the wrong field) and `AppError`/service-layer
 * integration deliberately left to the caller (`whatsapp-config.service.ts`,
 * `message-template.service.ts`, `marketing-campaign.service.ts`) rather
 * than baked in here — this module's only job is talking to Meta.
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

export interface MetaSendMessageResult {
  messageId: string;
}

export interface SendTemplateMessageArgs {
  phoneNumberId: string;
  accessToken: string;
  /** E.164 recipient phone number. */
  to: string;
  /** Meta's template `name` (not our local Mongo `_id`). */
  templateName: string;
  /** Meta's template `language` code, e.g. `"en_US"`. */
  languageCode: string;
  /** Values for the template body's `{{1}}`, `{{2}}`, ... placeholders, in
   * order. Omit/empty for a template with no body variables. */
  bodyParams?: string[];
}

/**
 * Sends a pre-approved WhatsApp message template to one recipient —
 * required outside the 24-hour customer-service window and for any
 * first-touch broadcast message, which covers every marketing send this
 * app makes (`marketing-campaign.service.ts`). Only builds a body-text
 * `components` array (see this file's header comment on scope); a template
 * with a media header or buttons would need its own `example.header_handle`
 * / button-parameter wiring, not added here.
 */
export async function sendTemplateMessage(
  args: SendTemplateMessageArgs,
): Promise<MetaSendMessageResult> {
  const { phoneNumberId, accessToken, to, templateName, languageCode, bodyParams } = args;
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;

  const templatePayload: Record<string, unknown> = {
    name: templateName,
    language: { code: languageCode },
  };
  if (bodyParams && bodyParams.length > 0) {
    templatePayload.components = [
      {
        type: "body",
        parameters: bodyParams.map((value) => ({ type: "text", text: value })),
      },
    ];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: templatePayload,
    }),
  });

  if (!response.ok) {
    const message = await readMetaErrorMessage(response, `Meta API error (HTTP ${response.status}).`);
    throw new Error(message);
  }

  const body = (await response.json()) as { messages?: { id: string }[] };
  const messageId = body.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("Meta accepted the message but returned no message id.");
  }
  return { messageId };
}

export interface ListMessageTemplatesArgs {
  wabaId: string;
  accessToken: string;
}

export interface MetaMessageTemplateSummary {
  metaTemplateId: string;
  name: string;
  /** Meta's raw language code, e.g. `"en_US"` — passed straight through to
   * `sendTemplateMessage`'s `languageCode` when this template is sent. */
  language: string;
  /** Meta's raw status string (`"APPROVED"`, `"PENDING"`, `"REJECTED"`,
   * `"PAUSED"`, `"DISABLED"`, ...) — normalized to this app's 3-value enum
   * by `message-template.service.ts`, not here (this module only talks to
   * Meta, it doesn't know this app's own schema). */
  status: string;
  /** Meta's raw category string (`"MARKETING"`, `"UTILITY"`,
   * `"AUTHENTICATION"`) — same normalize-elsewhere reasoning as `status`. */
  category: string;
  /** The template's BODY component text, `{{1}}`-style placeholders as
   * Meta stores them. */
  bodyText: string;
}

interface RawMetaTemplateComponent {
  type: string;
  text?: string;
}

interface RawMetaMessageTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: RawMetaTemplateComponent[];
}

// Meta paginates `message_templates` at up to 100/page. A restaurant's WABA
// realistically has a handful to a few dozen approved templates, so this
// cap (2,000 templates across 20 pages) exists purely as a runaway-loop
// guard against a malformed `paging.next` value, not a real limit this app
// expects to hit.
const TEMPLATE_LIST_PAGE_CAP = 20;

/**
 * Fetches every message template on a WABA (paginating through Meta's
 * `paging.next` cursor) and keeps only the fields this app's local cache
 * needs (`message-template.model.ts`). Templates with no BODY component
 * text are skipped — this app's send flow is body-text-only (see this
 * file's header comment), so a template with nothing to fill in on a send
 * isn't useful to show in the catalog.
 */
export async function listMessageTemplates(
  args: ListMessageTemplatesArgs,
): Promise<MetaMessageTemplateSummary[]> {
  const { wabaId, accessToken } = args;
  const templates: MetaMessageTemplateSummary[] = [];

  let url: string | null =
    `${META_API_BASE}/${encodeURIComponent(wabaId)}/message_templates` +
    `?limit=100&fields=id,name,language,status,category,components`;
  let pageCount = 0;

  while (url && pageCount < TEMPLATE_LIST_PAGE_CAP) {
    pageCount += 1;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const message = await readMetaErrorMessage(response, `Meta API error (HTTP ${response.status}).`);
      throw new Error(message);
    }

    const body = (await response.json()) as {
      data?: RawMetaMessageTemplate[];
      paging?: { next?: string };
    };

    for (const raw of body.data ?? []) {
      const bodyComponent = raw.components?.find((component) => component.type === "BODY");
      if (!bodyComponent?.text) continue;
      templates.push({
        metaTemplateId: raw.id,
        name: raw.name,
        language: raw.language,
        status: raw.status,
        category: raw.category,
        bodyText: bodyComponent.text,
      });
    }

    url = body.paging?.next ?? null;
  }

  return templates;
}
