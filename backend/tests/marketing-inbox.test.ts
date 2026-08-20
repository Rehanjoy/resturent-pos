import { createHmac } from "crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, tokenFor } from "./utils/fixtures";
import { AppError } from "../src/utils/app-error";

const PHONE_NUMBER_ID = "phone-number-id-inbox-test";
const META_APP_SECRET = "test-meta-app-secret-do-not-use-in-prod"; // matches tests/setup.ts
const FAILING_REPLY_PHONE = "+919876500999";

// Stubs every outbound Meta Graph API call — these tests must never make a
// real network call. `sendTextMessage` fails deterministically for one
// phone number so the "bot reply couldn't be delivered -> handoff" path can
// be exercised without a real API.
vi.mock("../src/lib/whatsapp/meta-api", () => ({
  verifyPhoneNumber: vi.fn(async ({ phoneNumberId }: { phoneNumberId: string }) => ({
    id: phoneNumberId,
    displayPhoneNumber: "+91 98765 43210",
    verifiedName: "Saffron Test Kitchen",
    qualityRating: "GREEN",
  })),
  sendTemplateMessage: vi.fn(async () => ({ messageId: "wamid.template.test" })),
  listMessageTemplates: vi.fn(async () => []),
  sendTextMessage: vi.fn(async ({ to }: { to: string }) => {
    if (to === FAILING_REPLY_PHONE) {
      throw new Error("Simulated WhatsApp send failure.");
    }
    return { messageId: `wamid.reply.${to.replace(/\D/g, "")}.${Math.random().toString(36).slice(2)}` };
  }),
}));

// Stubs Gemini entirely — real Gemini failure-handling behavior (network
// error / non-2xx / malformed JSON -> conservative handoff fallback) is
// covered directly against the real `generateReply` implementation in the
// "Gemini client" describe block below, mocking only `global.fetch`, never
// this module. Everywhere else in this file, this mock lets each test
// control exactly what the "AI" decided without any real API call.
vi.mock("../src/lib/ai/gemini", () => ({
  generateReply: vi.fn(async () => ({ reply: "Mocked default reply.", handoffToHuman: false })),
}));

// Stubs Socket.io — no real server is running in this test process
// (`emitToRestaurant` would silently no-op anyway per its own doc comment),
// but mocking it lets tests assert exactly which live event fired and with
// what payload, which is the whole point of Part 3's real-time requirement.
vi.mock("../src/sockets", () => ({
  emitToRestaurant: vi.fn(),
}));

import { createApp } from "../src/app";
import { encrypt } from "../src/utils/encryption";
import { WhatsappConfig } from "../src/models/whatsapp-config.model";
import { AiConfig } from "../src/models/ai-config.model";
import { Contact } from "../src/models/contact.model";
import { Conversation } from "../src/models/conversation.model";
import { WhatsappMessageLog } from "../src/models/whatsapp-message-log.model";
import { generateReply } from "../src/lib/ai/gemini";
import { sendTextMessage } from "../src/lib/whatsapp/meta-api";
import { emitToRestaurant } from "../src/sockets";
import * as conversationService from "../src/services/conversation.service";
import * as aiConfigService from "../src/services/ai-config.service";

const mockedGenerateReply = vi.mocked(generateReply);
const mockedSendTextMessage = vi.mocked(sendTextMessage);
const mockedEmitToRestaurant = vi.mocked(emitToRestaurant);

async function connectWhatsapp(restaurantId: string) {
  return WhatsappConfig.create({
    restaurantId,
    phoneNumberId: PHONE_NUMBER_ID,
    wabaId: "waba-id-inbox-test",
    accessTokenEncrypted: encrypt("a-real-looking-permanent-meta-access-token"),
    isConnected: true,
    connectedAt: new Date(),
  });
}

async function enableAutoReply(restaurantId: string, overrides: Partial<{ maxAutoRepliesPerConversation: number }> = {}) {
  return AiConfig.create({
    restaurantId,
    geminiApiKeyEncrypted: encrypt("test-gemini-api-key"),
    autoReplyEnabled: true,
    maxAutoRepliesPerConversation: overrides.maxAutoRepliesPerConversation ?? 5,
  });
}

function buildInboundWebhookPayload(args: {
  phoneNumberId: string;
  messageId: string;
  from: string;
  text: string;
  contactName?: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: args.phoneNumberId },
              contacts: args.contactName
                ? [{ wa_id: args.from, profile: { name: args.contactName } }]
                : [],
              messages: [{ id: args.messageId, from: args.from, type: "text", text: { body: args.text } }],
            },
          },
        ],
      },
    ],
  };
}

async function postSignedWebhook(app: ReturnType<typeof createApp>, payload: unknown) {
  const rawBody = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex")}`;
  return request(app)
    .post("/api/public/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", signature)
    .send(rawBody);
}

/**
 * Marketing module, Part 3 of 3 (AI Auto-Reply Inbox). Covers: the real
 * Gemini client's failure-handling fallback (network/HTTP/malformed-JSON
 * all -> conservative handoff, mocking only `global.fetch`), the inbound
 * webhook's find-or-create Contact/Conversation + logging, the AI
 * auto-reply decision tree (bot-eligible vs. not, handoff on AI flag, on
 * reply-cap, and on send failure), `whatsapp:message-received`/
 * `whatsapp:handoff-needed` socket events, every new endpoint's RBAC +
 * Owner-vs-Manager split, and hand-back-to-bot's cap reset.
 */
describe("Marketing module (Part 3: AI Auto-Reply Inbox)", () => {
  const app = createApp();

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    vi.clearAllMocks();
    mockedGenerateReply.mockResolvedValue({ reply: "Mocked default reply.", handoffToHuman: false });
  });

  describe("Gemini client — failure handling (real generateReply, mocked fetch only)", () => {
    const originalFetch = global.fetch;

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it("falls back to handoffToHuman: true on a network error", async () => {
      const { generateReply: realGenerateReply } = await vi.importActual<
        typeof import("../src/lib/ai/gemini")
      >("../src/lib/ai/gemini");

      global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

      const result = await realGenerateReply({
        apiKey: "fake-key",
        restaurantContext: "Restaurant: Test",
        history: [],
        inboundMessage: "Hi, are you open?",
      });

      expect(result.handoffToHuman).toBe(true);
      expect(result.reply.length).toBeGreaterThan(0);
    });

    it("falls back to handoffToHuman: true on a non-2xx response", async () => {
      const { generateReply: realGenerateReply } = await vi.importActual<
        typeof import("../src/lib/ai/gemini")
      >("../src/lib/ai/gemini");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "quota exceeded",
      }) as unknown as typeof fetch;

      const result = await realGenerateReply({
        apiKey: "fake-key",
        restaurantContext: "Restaurant: Test",
        history: [],
        inboundMessage: "Hi",
      });

      expect(result.handoffToHuman).toBe(true);
    });

    it("falls back to handoffToHuman: true on malformed JSON in the model's response", async () => {
      const { generateReply: realGenerateReply } = await vi.importActual<
        typeof import("../src/lib/ai/gemini")
      >("../src/lib/ai/gemini");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "this is not valid json {" }] } }],
        }),
      }) as unknown as typeof fetch;

      const result = await realGenerateReply({
        apiKey: "fake-key",
        restaurantContext: "Restaurant: Test",
        history: [],
        inboundMessage: "Hi",
      });

      expect(result.handoffToHuman).toBe(true);
    });

    it("returns the parsed result on a well-formed response", async () => {
      const { generateReply: realGenerateReply } = await vi.importActual<
        typeof import("../src/lib/ai/gemini")
      >("../src/lib/ai/gemini");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ reply: "We open at 11am.", handoffToHuman: false }) }],
              },
            },
          ],
        }),
      }) as unknown as typeof fetch;

      const result = await realGenerateReply({
        apiKey: "fake-key",
        restaurantContext: "Restaurant: Test",
        history: [],
        inboundMessage: "What time do you open?",
      });

      expect(result).toEqual({ reply: "We open at 11am.", handoffToHuman: false });
    });
  });

  describe("AI config — RBAC + Owner-vs-Manager split", () => {
    it("rejects unauthenticated requests", async () => {
      const getRes = await request(app).get("/api/marketing/ai-config");
      expect(getRes.status).toBe(401);
    });

    it("blocks every non-owner/manager role from viewing", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);
        const res = await request(app).get("/api/marketing/ai-config").set("Authorization", `Bearer ${token}`);
        expect(res.status, `role ${role} should be blocked`).toBe(403);
      }
    });

    it("lets Manager view but blocks Manager from editing (403)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: manager } = await createTestStaff(restaurantId, "manager");
      const token = tokenFor(manager);

      const getRes = await request(app).get("/api/marketing/ai-config").set("Authorization", `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.config).toBeNull();

      const patchRes = await request(app)
        .patch("/api/marketing/ai-config")
        .set("Authorization", `Bearer ${token}`)
        .send({ geminiApiKey: "manager-attempt-key-value" });
      expect(patchRes.status).toBe(403);
    });

    it("lets Owner save a key and settings, never returning the key itself", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .patch("/api/marketing/ai-config")
        .set("Authorization", `Bearer ${token}`)
        .send({
          geminiApiKey: "a-real-looking-gemini-api-key-value",
          systemPromptExtra: "We're closed on Mondays.",
          autoReplyEnabled: true,
          maxAutoRepliesPerConversation: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.config.hasGeminiApiKey).toBe(true);
      expect(res.body.config.autoReplyEnabled).toBe(true);
      expect(res.body.config.maxAutoRepliesPerConversation).toBe(3);
      expect(res.body.config.geminiApiKey).toBeUndefined();
      expect(res.body.config.geminiApiKeyEncrypted).toBeUndefined();

      const stored = await AiConfig.findOne({ restaurantId }).select("+geminiApiKeyEncrypted");
      expect(stored?.geminiApiKeyEncrypted).toBeDefined();
      expect(stored?.geminiApiKeyEncrypted).not.toContain("a-real-looking-gemini-api-key-value");
    });

    it("rejects turning on auto-reply with no Gemini key saved (400)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await expect(
        aiConfigService.saveAiConfig(restaurantId, { autoReplyEnabled: true }),
      ).rejects.toMatchObject({ code: "GEMINI_KEY_REQUIRED" } satisfies Partial<AppError>);
    });
  });

  describe("Conversations — RBAC", () => {
    it("rejects unauthenticated requests on every route", async () => {
      expect((await request(app).get("/api/marketing/conversations")).status).toBe(401);
      expect((await request(app).get("/api/marketing/conversations/000000000000000000000000")).status).toBe(401);
      expect(
        (await request(app).post("/api/marketing/conversations/000000000000000000000000/reply").send({ text: "hi" }))
          .status,
      ).toBe(401);
    });

    it("blocks every non-owner/manager role", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);

        const listRes = await request(app)
          .get("/api/marketing/conversations")
          .set("Authorization", `Bearer ${token}`);
        expect(listRes.status, `role ${role} should be blocked from listing conversations`).toBe(403);
      }
    });

    it("lets both Owner and Manager list conversations", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      for (const role of ["owner", "manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);
        const res = await request(app).get("/api/marketing/conversations").set("Authorization", `Bearer ${token}`);
        expect(res.status, `role ${role} should be able to list`).toBe(200);
      }
    });
  });

  describe("Inbound webhook — Contact/Conversation creation + logging", () => {
    it("creates a Contact (source: whatsapp) and Conversation on the first inbound message", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);

      const payload = buildInboundWebhookPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        messageId: "wamid.inbound.1",
        from: "919876500001",
        text: "Hi, what are your hours?",
        contactName: "Asha Rao",
      });

      const res = await postSignedWebhook(app, payload);
      expect(res.status).toBe(200);

      const contact = await Contact.findOne({ restaurantId, phone: "+919876500001" });
      expect(contact).not.toBeNull();
      expect(contact?.source).toBe("whatsapp");
      expect(contact?.name).toBe("Asha Rao");

      const conversation = await Conversation.findOne({ restaurantId, contactId: contact?._id });
      expect(conversation).not.toBeNull();
      expect(conversation?.status).toBe("bot_active"); // auto-reply not configured -> stays bot_active, just no reply sent
      expect(conversation?.lastMessagePreview).toBe("Hi, what are your hours?");

      const log = await WhatsappMessageLog.findOne({ restaurantId, direction: "inbound" });
      expect(log?.senderType).toBe("customer");
      expect(log?.messageText).toBe("Hi, what are your hours?");
      expect(log?.conversationId?.toString()).toBe(conversation?._id.toString());
    });

    it("reuses the same Conversation across multiple inbound messages from the same contact", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);

      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.a",
          from: "919876500002",
          text: "First message",
        }),
      );
      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.b",
          from: "919876500002",
          text: "Second message",
        }),
      );

      expect(await Conversation.countDocuments({ restaurantId })).toBe(1);
      expect(await Contact.countDocuments({ restaurantId })).toBe(1);
      const conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.lastMessagePreview).toBe("Second message");
    });

    it("emits whatsapp:message-received (not handoff-needed) when auto-reply is disabled", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);

      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.c",
          from: "919876500003",
          text: "Hello",
        }),
      );

      expect(mockedGenerateReply).not.toHaveBeenCalled();
      const events = mockedEmitToRestaurant.mock.calls.map((call) => call[1]);
      expect(events).toContain("whatsapp:message-received");
      expect(events).not.toContain("whatsapp:handoff-needed");
    });
  });

  describe("Inbound webhook — AI auto-reply", () => {
    it("sends a bot reply, logs it, and stays bot_active when the AI does not flag a handoff", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      await enableAutoReply(restaurantId, { maxAutoRepliesPerConversation: 5 });
      mockedGenerateReply.mockResolvedValueOnce({ reply: "We're open 11am-11pm daily.", handoffToHuman: false });

      const res = await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.d",
          from: "919876500004",
          text: "What are your hours?",
        }),
      );
      expect(res.status).toBe(200);

      expect(mockedGenerateReply).toHaveBeenCalledTimes(1);
      expect(mockedSendTextMessage).toHaveBeenCalledTimes(1);

      const conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.status).toBe("bot_active");
      expect(conversation?.aiReplyCount).toBe(1);
      expect(conversation?.lastMessagePreview).toBe("We're open 11am-11pm daily.");

      const botLog = await WhatsappMessageLog.findOne({ restaurantId, senderType: "bot" });
      expect(botLog?.direction).toBe("outbound");
      expect(botLog?.messageText).toBe("We're open 11am-11pm daily.");
      expect(botLog?.status).toBe("sent");

      const events = mockedEmitToRestaurant.mock.calls.map((call) => call[1]);
      expect(events).toContain("whatsapp:message-received");
      expect(events).not.toContain("whatsapp:handoff-needed");
    });

    it("sets needs_human and emits whatsapp:handoff-needed when the AI flags handoffToHuman", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      await enableAutoReply(restaurantId);
      mockedGenerateReply.mockResolvedValueOnce({
        reply: "Let me get someone to help with that reservation.",
        handoffToHuman: true,
        handoffReason: "Reservation request.",
      });

      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.e",
          from: "919876500005",
          text: "Can I book a table for 6 tonight?",
        }),
      );

      const conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.status).toBe("needs_human");

      const events = mockedEmitToRestaurant.mock.calls.map((call) => call[1]);
      expect(events).toContain("whatsapp:handoff-needed");
      const handoffCall = mockedEmitToRestaurant.mock.calls.find((call) => call[1] === "whatsapp:handoff-needed");
      expect((handoffCall?.[2] as { reason?: string })?.reason).toBe("Reservation request.");
    });

    it("triggers a handoff once the reply cap is reached, even when the AI never flags one", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      await enableAutoReply(restaurantId, { maxAutoRepliesPerConversation: 2 });
      mockedGenerateReply.mockResolvedValue({ reply: "Sure, here's the info.", handoffToHuman: false });

      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.f1",
          from: "919876500006",
          text: "Question one",
        }),
      );
      let conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.status).toBe("bot_active");
      expect(conversation?.aiReplyCount).toBe(1);

      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.f2",
          from: "919876500006",
          text: "Question two",
        }),
      );
      conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.aiReplyCount).toBe(2);
      expect(conversation?.status).toBe("needs_human"); // cap (2) reached on the 2nd reply

      // A third message must NOT get an auto-reply — conversation is no
      // longer bot_active.
      mockedGenerateReply.mockClear();
      await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.f3",
          from: "919876500006",
          text: "Question three",
        }),
      );
      expect(mockedGenerateReply).not.toHaveBeenCalled();
    });

    it("hands off when the bot's reply fails to send, without crashing the webhook", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      await enableAutoReply(restaurantId);
      mockedGenerateReply.mockResolvedValueOnce({ reply: "Here you go.", handoffToHuman: false });

      const res = await postSignedWebhook(
        app,
        buildInboundWebhookPayload({
          phoneNumberId: PHONE_NUMBER_ID,
          messageId: "wamid.inbound.g",
          from: FAILING_REPLY_PHONE.replace("+", ""),
          text: "Anything?",
        }),
      );
      expect(res.status).toBe(200);

      const conversation = await Conversation.findOne({ restaurantId });
      expect(conversation?.status).toBe("needs_human");

      const failedLog = await WhatsappMessageLog.findOne({ restaurantId, senderType: "bot", status: "failed" });
      expect(failedLog).not.toBeNull();
    });

    it.each(["needs_human", "human_active", "closed"] as const)(
      "never auto-replies when the conversation is already %s, even with AI enabled",
      async (status) => {
        const restaurant = await createTestRestaurant();
        const restaurantId = restaurant._id.toString();
        await connectWhatsapp(restaurantId);
        await enableAutoReply(restaurantId);

        const contact = await Contact.create({
          restaurantId,
          name: "Existing Contact",
          phone: "+919876500007",
          source: "whatsapp",
          optedIn: true,
        });
        await Conversation.create({
          restaurantId,
          contactId: contact._id,
          phone: contact.phone,
          status,
          aiReplyCount: 0,
          lastMessageAt: new Date(),
          lastMessagePreview: "Previous message",
        });

        await postSignedWebhook(
          app,
          buildInboundWebhookPayload({
            phoneNumberId: PHONE_NUMBER_ID,
            messageId: `wamid.inbound.${status}`,
            from: "919876500007",
            text: "Are you there?",
          }),
        );

        expect(mockedGenerateReply).not.toHaveBeenCalled();
        expect(mockedSendTextMessage).not.toHaveBeenCalled();

        const conversation = await Conversation.findOne({ restaurantId });
        expect(conversation?.status).toBe(status); // unchanged
        expect(conversation?.lastMessagePreview).toBe("Are you there?"); // still logged
      },
    );
  });

  describe("Conversations — reply / close / hand-back-to-bot", () => {
    async function seedConversation(restaurantId: string, overrides: Partial<{ status: "bot_active" | "needs_human" | "human_active" | "closed"; aiReplyCount: number }> = {}) {
      const contact = await Contact.create({
        restaurantId,
        name: "Manual Reply Contact",
        phone: "+919876500008",
        source: "whatsapp",
        optedIn: true,
      });
      const conversation = await Conversation.create({
        restaurantId,
        contactId: contact._id,
        phone: contact.phone,
        status: overrides.status ?? "needs_human",
        aiReplyCount: overrides.aiReplyCount ?? 0,
        lastMessageAt: new Date(),
        lastMessagePreview: "Customer needs help",
      });
      return { contact, conversation };
    }

    it("lets staff send a manual reply — claims the conversation and moves it to human_active", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const { conversation } = await seedConversation(restaurantId);
      const { user: manager } = await createTestStaff(restaurantId, "manager");
      const token = tokenFor(manager);

      const res = await request(app)
        .post(`/api/marketing/conversations/${conversation._id.toString()}/reply`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Hi! A table for 6 works at 8pm." });

      expect(res.status).toBe(200);
      expect(res.body.conversation.status).toBe("human_active");
      expect(res.body.conversation.assignedStaffId).toBe(manager._id.toString());

      const log = await WhatsappMessageLog.findOne({ restaurantId, senderType: "staff" });
      expect(log?.direction).toBe("outbound");
      expect(log?.messageText).toBe("Hi! A table for 6 works at 8pm.");
    });

    it("rejects a manual reply when WhatsApp isn't connected", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { conversation } = await seedConversation(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .post(`/api/marketing/conversations/${conversation._id.toString()}/reply`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Hello" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("WHATSAPP_NOT_CONNECTED");
    });

    it("closes a conversation", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { conversation } = await seedConversation(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .patch(`/api/marketing/conversations/${conversation._id.toString()}/close`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversation.status).toBe("closed");
    });

    it("hand-back-to-bot resets status to bot_active and aiReplyCount to 0", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { conversation } = await seedConversation(restaurantId, { status: "needs_human", aiReplyCount: 4 });
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .patch(`/api/marketing/conversations/${conversation._id.toString()}/hand-back-to-bot`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversation.status).toBe("bot_active");
      expect(res.body.conversation.aiReplyCount).toBe(0);

      const stored = await Conversation.findById(conversation._id);
      expect(stored?.status).toBe("bot_active");
      expect(stored?.aiReplyCount).toBe(0);
    });

    it("returns 404 for a conversation belonging to another restaurant", async () => {
      const restaurantA = await createTestRestaurant();
      const restaurantB = await createTestRestaurant();
      const { conversation } = await seedConversation(restaurantA._id.toString());
      const { user: owner } = await createTestStaff(restaurantB._id.toString(), "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .get(`/api/marketing/conversations/${conversation._id.toString()}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("Conversation list + detail", () => {
    it("lists conversations sorted by lastMessageAt desc, filterable by status", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const contactA = await Contact.create({ restaurantId, name: "A", phone: "+919876500010", source: "whatsapp", optedIn: true });
      const contactB = await Contact.create({ restaurantId, name: "B", phone: "+919876500011", source: "whatsapp", optedIn: true });

      await Conversation.create({
        restaurantId,
        contactId: contactA._id,
        phone: contactA.phone,
        status: "needs_human",
        aiReplyCount: 0,
        lastMessageAt: new Date(Date.now() - 60_000),
        lastMessagePreview: "Older",
      });
      await Conversation.create({
        restaurantId,
        contactId: contactB._id,
        phone: contactB.phone,
        status: "bot_active",
        aiReplyCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: "Newer",
      });

      const allRes = await request(app).get("/api/marketing/conversations").set("Authorization", `Bearer ${token}`);
      expect(allRes.status).toBe(200);
      expect(allRes.body.conversations).toHaveLength(2);
      expect(allRes.body.conversations[0].lastMessagePreview).toBe("Newer"); // most recent first

      const filteredRes = await request(app)
        .get("/api/marketing/conversations?status=needs_human")
        .set("Authorization", `Bearer ${token}`);
      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.conversations).toHaveLength(1);
      expect(filteredRes.body.conversations[0].lastMessagePreview).toBe("Older");
    });

    it("returns full message history on the detail endpoint", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const contact = await Contact.create({ restaurantId, name: "C", phone: "+919876500012", source: "whatsapp", optedIn: true });
      const conversation = await Conversation.create({
        restaurantId,
        contactId: contact._id,
        phone: contact.phone,
        status: "bot_active",
        aiReplyCount: 1,
        lastMessageAt: new Date(),
        lastMessagePreview: "Bot reply",
      });
      await WhatsappMessageLog.create({
        restaurantId,
        conversationId: conversation._id,
        contactId: contact._id,
        phone: contact.phone,
        direction: "inbound",
        senderType: "customer",
        status: "delivered",
        messageText: "Hi there",
        statusUpdatedAt: new Date(),
      });
      await WhatsappMessageLog.create({
        restaurantId,
        conversationId: conversation._id,
        contactId: contact._id,
        phone: contact.phone,
        direction: "outbound",
        senderType: "bot",
        status: "sent",
        messageText: "Bot reply",
        statusUpdatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/marketing/conversations/${conversation._id.toString()}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(conversation._id.toString());
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].messageText).toBe("Hi there");
      expect(res.body.messages[1].messageText).toBe("Bot reply");
    });
  });

  // Direct service-level smoke test — exercises `processWebhookEvent` isn't
  // the only path into the AI decision tree; `conversation.service.ts` and
  // `ai-config.service.ts` are also covered directly, not just via HTTP.
  describe("Service-level", () => {
    it("buildRestaurantContext includes the restaurant name and menu section without throwing when there's no menu yet", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const context = await aiConfigService.buildRestaurantContext(restaurantId, "We're closed Mondays.");
      expect(context).toContain(restaurant.name);
      expect(context).toContain("We're closed Mondays.");
    });

    it("findConversationOrThrow throws AppError(404) for a bad id", async () => {
      const restaurant = await createTestRestaurant();
      await expect(
        conversationService.findConversationOrThrow(restaurant._id.toString(), "not-a-valid-id"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<AppError>);
    });
  });
});
