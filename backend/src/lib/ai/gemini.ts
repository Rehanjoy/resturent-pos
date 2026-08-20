/**
 * Google Gemini client for the AI auto-reply feature (Marketing module
 * Part 3) — a plain `fetch` call against Gemini's REST API, matching this
 * codebase's existing preference for direct API calls over an SDK (see
 * `lib/whatsapp/meta-api.ts`'s own header comment on the same choice).
 *
 * Uses `gemini-2.0-flash` — Google's fast/cheap model, the right fit for
 * short, low-latency WhatsApp chat replies; the higher-cost "pro" tier
 * buys nothing here and this app never sends more than a restaurant's menu
 * plus a short chat history as context.
 *
 * JSON mode: `generationConfig.responseMimeType: "application/json"` plus
 * a `responseSchema` (Gemini's structured-output feature) rather than
 * relying on prompt instructions alone to produce parseable JSON — belt
 * and suspenders, since `generateReply` still defensively `JSON.parse`s
 * and validates the shape before trusting it (schema mode constrains the
 * model's output but this app never assumes any external API response is
 * well-formed without checking).
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.0-flash";

export interface GeminiChatTurn {
  /** `"customer"` -> Gemini's `"user"` role, `"assistant"` (this app's own
   * past bot/staff replies) -> Gemini's `"model"` role — translated in
   * `buildContents` below so callers never need to know Gemini's role
   * vocabulary. */
  role: "customer" | "assistant";
  text: string;
}

export interface GenerateReplyArgs {
  apiKey: string;
  /** Pre-built restaurant/menu/owner-notes context text — see
   * `ai-config.service.ts` `buildRestaurantContext`, the one place that
   * assembles this so it's never duplicated between callers. */
  restaurantContext: string;
  /** Recent conversation history, oldest first, NOT including the new
   * inbound message (that's `inboundMessage`) — callers pass roughly the
   * last 10-15 messages, enough for the model to follow the thread without
   * an unbounded/expensive prompt. */
  history: GeminiChatTurn[];
  inboundMessage: string;
}

export interface GenerateReplyResult {
  reply: string;
  handoffToHuman: boolean;
  handoffReason?: string;
}

/** Returned whenever Gemini can't be reached, errors, or returns something
 * this app can't parse as the expected shape — a bot failure must never
 * crash the webhook handler or leave a customer's message unanswered, and
 * "hand off to a human" is always the safe default on uncertainty (per
 * this feature's own conservative-handoff design goal). */
const FALLBACK_RESULT: GenerateReplyResult = {
  reply: "Thanks for reaching out — let me get someone to help you with that.",
  handoffToHuman: true,
  handoffReason: "The AI assistant could not generate a reply.",
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    handoffToHuman: { type: "BOOLEAN" },
    handoffReason: { type: "STRING" },
  },
  required: ["reply", "handoffToHuman"],
} as const;

function buildSystemInstruction(restaurantContext: string): string {
  return [
    "You are a WhatsApp customer-support assistant for a restaurant, chatting directly with a customer.",
    "",
    "Rules you must always follow:",
    "1. Answer only using the restaurant and menu information given below. Never invent dishes, prices, offers, opening hours, or promises that are not listed there.",
    "2. If the customer asks something the information below does not cover, say plainly that you're not sure and that a staff member will help — do not guess.",
    "3. Set \"handoffToHuman\" to true for: any reservation/table-booking request, any food order/delivery request, any complaint, any explicit request to speak to a person/human/staff/manager, or any message you are not confident you can answer correctly from the information below. Be conservative — routing a customer to a human when the bot could have handled it is far cheaper than leaving a frustrated customer stuck talking to a bot.",
    "4. When \"handoffToHuman\" is true, still write a short, polite \"reply\" letting the customer know a staff member will follow up shortly — never leave \"reply\" empty.",
    "5. Keep replies short, friendly, and to the point — this is a WhatsApp chat, not an email.",
    "",
    "Respond with ONLY a JSON object shaped exactly like this, no markdown formatting and no text outside the JSON:",
    '{"reply": "string", "handoffToHuman": true or false, "handoffReason": "string, only if handoffToHuman is true"}',
    "",
    "Restaurant and menu information:",
    restaurantContext,
  ].join("\n");
}

function buildContents(history: GeminiChatTurn[], inboundMessage: string) {
  const turns: GeminiChatTurn[] = [...history, { role: "customer", text: inboundMessage }];
  return turns.map((turn) => ({
    role: turn.role === "customer" ? "user" : "model",
    parts: [{ text: turn.text }],
  }));
}

function isValidResult(value: unknown): value is GenerateReplyResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.reply === "string" &&
    candidate.reply.trim().length > 0 &&
    typeof candidate.handoffToHuman === "boolean" &&
    (candidate.handoffReason === undefined || typeof candidate.handoffReason === "string")
  );
}

/**
 * Generates one AI reply to a customer's inbound WhatsApp message. Never
 * throws — any failure (network error, non-2xx response, missing/
 * malformed JSON in the model's output) resolves to `FALLBACK_RESULT`
 * (`handoffToHuman: true`) so the caller (`whatsapp-webhook.service.ts`)
 * can always safely act on the result without its own try/catch around
 * this call.
 */
export async function generateReply(args: GenerateReplyArgs): Promise<GenerateReplyResult> {
  const { apiKey, restaurantContext, history, inboundMessage } = args;

  try {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemInstruction(restaurantContext) }] },
        contents: buildContents(history, inboundMessage),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.3,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      console.error(`[gemini] API error (HTTP ${response.status}): ${bodyText}`);
      return FALLBACK_RESULT;
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("[gemini] Response had no text content", JSON.stringify(body));
      return FALLBACK_RESULT;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[gemini] Response text was not valid JSON", rawText, parseError);
      return FALLBACK_RESULT;
    }

    if (!isValidResult(parsed)) {
      console.error("[gemini] Response JSON did not match the expected shape", parsed);
      return FALLBACK_RESULT;
    }

    return parsed;
  } catch (error) {
    console.error("[gemini] generateReply failed — falling back to human handoff", error);
    return FALLBACK_RESULT;
  }
}
