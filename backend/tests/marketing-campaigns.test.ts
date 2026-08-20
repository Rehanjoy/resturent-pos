import { createHmac } from "crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, tokenFor } from "./utils/fixtures";
import { AppError } from "../src/utils/app-error";

// Stubs every outbound Meta Graph API call this test file exercises — these
// tests must never make a real network call. `sendTemplateMessage` fails
// deterministically for one specific phone number so a campaign send can
// exercise its per-recipient failure path without any real API.
const FAILING_RECIPIENT_PHONE = "+919876500099";

vi.mock("../src/lib/whatsapp/meta-api", () => ({
  verifyPhoneNumber: vi.fn(async ({ phoneNumberId }: { phoneNumberId: string }) => ({
    id: phoneNumberId,
    displayPhoneNumber: "+91 98765 43210",
    verifiedName: "Saffron Test Kitchen",
    qualityRating: "GREEN",
  })),
  sendTemplateMessage: vi.fn(async ({ to }: { to: string }) => {
    if (to === FAILING_RECIPIENT_PHONE) {
      throw new Error("Recipient phone number is not a valid WhatsApp user.");
    }
    return { messageId: `wamid.test.${to.replace(/\D/g, "")}` };
  }),
  listMessageTemplates: vi.fn(async () => [
    {
      metaTemplateId: "meta-template-approved",
      name: "weekend_offer",
      language: "en_US",
      status: "APPROVED",
      category: "MARKETING",
      bodyText: "Hi {{1}}, enjoy {{2}}% off this weekend!",
    },
    {
      metaTemplateId: "meta-template-pending",
      name: "order_update",
      language: "en_US",
      status: "PENDING",
      category: "UTILITY",
      bodyText: "Your order is on the way.",
    },
  ]),
}));

import { createApp } from "../src/app";
import { encrypt } from "../src/utils/encryption";
import { WhatsappConfig } from "../src/models/whatsapp-config.model";
import { MessageTemplate } from "../src/models/message-template.model";
import { MarketingCampaign } from "../src/models/marketing-campaign.model";
import { WhatsappMessageLog } from "../src/models/whatsapp-message-log.model";
import { Contact } from "../src/models/contact.model";
import * as messageTemplateService from "../src/services/message-template.service";
import * as campaignService from "../src/services/marketing-campaign.service";

const PHONE_NUMBER_ID = "phone-number-id-test";
const META_APP_SECRET = "test-meta-app-secret-do-not-use-in-prod";
const WEBHOOK_VERIFY_TOKEN = "test-webhook-verify-token";

async function connectWhatsapp(restaurantId: string) {
  return WhatsappConfig.create({
    restaurantId,
    phoneNumberId: PHONE_NUMBER_ID,
    wabaId: "waba-id-test",
    accessTokenEncrypted: encrypt("a-real-looking-permanent-meta-access-token"),
    isConnected: true,
    connectedAt: new Date(),
  });
}

async function createApprovedTemplate(restaurantId: string, overrides: Partial<{ variableCount: number; bodyText: string }> = {}) {
  return MessageTemplate.create({
    restaurantId,
    metaTemplateId: "meta-template-approved",
    name: "weekend_offer",
    language: "en_US",
    category: "marketing",
    bodyText: overrides.bodyText ?? "Hi {{1}}, enjoy {{2}}% off this weekend!",
    status: "approved",
    variableCount: overrides.variableCount ?? 2,
    syncedAt: new Date(),
  });
}

/**
 * Marketing module, Part 2 of 3 (Templates + Campaigns + WhatsApp webhook).
 * Covers: RBAC on every new endpoint, template sync's Meta-status/category
 * normalization, audience resolution (`all`/`tags`/`contactIds` all
 * silently excluding opted-out contacts with an accurate count), the
 * batched-send counters landing correctly (success and per-recipient
 * failure), the webhook's GET verification handshake, POST signature
 * rejection, and a valid signed POST updating a `WhatsappMessageLog` row +
 * its parent campaign's counters by `metaMessageId`.
 */
describe("Marketing module (Part 2: Templates + Campaigns + webhook)", () => {
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
  });

  describe("Templates — RBAC", () => {
    it("blocks every non-owner/manager role and unauthenticated requests", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const unauth = await request(app).get("/api/marketing/templates");
      expect(unauth.status).toBe(401);

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);
        const listRes = await request(app)
          .get("/api/marketing/templates")
          .set("Authorization", `Bearer ${token}`);
        expect(listRes.status, `role ${role} should be blocked from listing templates`).toBe(403);

        const syncRes = await request(app)
          .post("/api/marketing/templates/sync")
          .set("Authorization", `Bearer ${token}`);
        expect(syncRes.status, `role ${role} should be blocked from syncing templates`).toBe(403);
      }
    });

    it("lets Owner and Manager both view and sync", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);

      for (const role of ["owner", "manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);
        const syncRes = await request(app)
          .post("/api/marketing/templates/sync")
          .set("Authorization", `Bearer ${token}`);
        expect(syncRes.status, `role ${role} should be able to sync`).toBe(200);
      }
    });
  });

  describe("Templates — sync", () => {
    it("rejects sync with a clear error when WhatsApp isn't connected", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await expect(messageTemplateService.syncMessageTemplates(restaurantId)).rejects.toMatchObject({
        code: "WHATSAPP_NOT_CONNECTED",
      } satisfies Partial<AppError>);
    });

    it("upserts Meta's templates, normalizing status/category and parsing variableCount", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);

      const result = await messageTemplateService.syncMessageTemplates(restaurantId);
      expect(result).toEqual({ total: 2, created: 2, updated: 0 });

      const approved = await MessageTemplate.findOne({ restaurantId, metaTemplateId: "meta-template-approved" });
      expect(approved?.status).toBe("approved");
      expect(approved?.category).toBe("marketing");
      expect(approved?.variableCount).toBe(2);

      const pending = await MessageTemplate.findOne({ restaurantId, metaTemplateId: "meta-template-pending" });
      expect(pending?.status).toBe("pending");
      expect(pending?.category).toBe("utility");
      expect(pending?.variableCount).toBe(0);

      // Re-syncing upserts in place rather than duplicating.
      const secondSync = await messageTemplateService.syncMessageTemplates(restaurantId);
      expect(secondSync).toEqual({ total: 2, created: 0, updated: 2 });
      expect(await MessageTemplate.countDocuments({ restaurantId })).toBe(2);
    });
  });

  describe("Campaigns — RBAC", () => {
    it("blocks every non-owner/manager role and unauthenticated requests", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const unauth = await request(app).get("/api/marketing/campaigns");
      expect(unauth.status).toBe(401);

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);
        const res = await request(app)
          .post("/api/marketing/campaigns")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "x", templateId: "000000000000000000000000", audience: { type: "all" } });
        expect(res.status, `role ${role} should be blocked from creating campaigns`).toBe(403);
      }
    });
  });

  describe("Campaigns — audience resolution", () => {
    it("resolves 'all' to only opted-in contacts, silently excluding opted-out ones", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");

      await Contact.create({ restaurantId, name: "Opted In", phone: "+919876500001", source: "manual", optedIn: true });
      await Contact.create({ restaurantId, name: "Opted Out", phone: "+919876500002", source: "manual", optedIn: false });

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Broadcast",
        templateId: template._id.toString(),
        audience: { type: "all" },
        bodyParams: ["Asha", "20"],
      });

      expect(campaign.audienceDescription).toBe("All contacts");
      expect(campaign.recipientCount).toBe(1); // opted-out contact silently excluded
      expect(campaign.sentCount).toBe(1);
      expect(campaign.status).toBe("completed");

      const logs = await WhatsappMessageLog.find({ restaurantId, campaignId: campaign.id });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.phone).toBe("+919876500001");
    });

    it("resolves 'tags' to only matching, opted-in contacts", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");

      await Contact.create({ restaurantId, name: "VIP In", phone: "+919876500003", tags: ["vip"], source: "manual", optedIn: true });
      await Contact.create({ restaurantId, name: "VIP Out", phone: "+919876500004", tags: ["vip"], source: "manual", optedIn: false });
      await Contact.create({ restaurantId, name: "Regular", phone: "+919876500005", tags: ["regular"], source: "manual", optedIn: true });

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "VIP Broadcast",
        templateId: template._id.toString(),
        audience: { type: "tags", tags: ["vip"] },
        bodyParams: ["Asha", "20"],
      });

      expect(campaign.audienceDescription).toBe("Tag: vip");
      expect(campaign.recipientCount).toBe(1);
      expect(campaign.sentCount).toBe(1);
    });

    it("resolves 'contactIds' to only the selected, opted-in contacts", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");

      const included = await Contact.create({ restaurantId, name: "Included", phone: "+919876500006", source: "manual", optedIn: true });
      const excludedOptOut = await Contact.create({ restaurantId, name: "Opted Out", phone: "+919876500007", source: "manual", optedIn: false });

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Selected Broadcast",
        templateId: template._id.toString(),
        audience: {
          type: "contactIds",
          contactIds: [included._id.toString(), excludedOptOut._id.toString()],
        },
        bodyParams: ["Asha", "20"],
      });

      expect(campaign.audienceDescription).toBe("1 contacts (manually selected)");
      expect(campaign.recipientCount).toBe(1);
    });

    it("does not error on a zero-recipient audience — completes with recipientCount 0", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Empty Broadcast",
        templateId: template._id.toString(),
        audience: { type: "tags", tags: ["nonexistent-tag"] },
        bodyParams: ["Asha", "20"],
      });

      expect(campaign.recipientCount).toBe(0);
      expect(campaign.sentCount).toBe(0);
      expect(campaign.status).toBe("completed");
    });
  });

  describe("Campaigns — validation", () => {
    it("rejects a non-approved template", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const pendingTemplate = await MessageTemplate.create({
        restaurantId,
        metaTemplateId: "meta-template-pending",
        name: "order_update",
        language: "en_US",
        category: "utility",
        bodyText: "Your order is on the way.",
        status: "pending",
        variableCount: 0,
        syncedAt: new Date(),
      });

      await expect(
        campaignService.createCampaign(restaurantId, owner._id.toString(), {
          name: "Broadcast",
          templateId: pendingTemplate._id.toString(),
          audience: { type: "all" },
        }),
      ).rejects.toMatchObject({ code: "TEMPLATE_NOT_APPROVED" } satisfies Partial<AppError>);
    });

    it("rejects a bodyParams count mismatch", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const template = await createApprovedTemplate(restaurantId, { variableCount: 2 });

      await expect(
        campaignService.createCampaign(restaurantId, owner._id.toString(), {
          name: "Broadcast",
          templateId: template._id.toString(),
          audience: { type: "all" },
          bodyParams: ["only-one-value"],
        }),
      ).rejects.toMatchObject({ code: "TEMPLATE_PARAM_COUNT_MISMATCH" } satisfies Partial<AppError>);
    });

    it("rejects sending when WhatsApp isn't connected", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const template = await createApprovedTemplate(restaurantId, { variableCount: 0, bodyText: "Hello!" });

      await expect(
        campaignService.createCampaign(restaurantId, owner._id.toString(), {
          name: "Broadcast",
          templateId: template._id.toString(),
          audience: { type: "all" },
        }),
      ).rejects.toMatchObject({ code: "WHATSAPP_NOT_CONNECTED" } satisfies Partial<AppError>);
    });
  });

  describe("Campaigns — send outcome + counters", () => {
    it("logs a per-recipient failure and increments failedCount without failing the whole campaign", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");

      await Contact.create({ restaurantId, name: "Good", phone: "+919876500008", source: "manual", optedIn: true });
      await Contact.create({ restaurantId, name: "Bad", phone: FAILING_RECIPIENT_PHONE, source: "manual", optedIn: true });

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Mixed Outcome Broadcast",
        templateId: template._id.toString(),
        audience: { type: "all" },
        bodyParams: ["Asha", "20"],
      });

      expect(campaign.recipientCount).toBe(2);
      expect(campaign.sentCount).toBe(1);
      expect(campaign.failedCount).toBe(1);
      expect(campaign.status).toBe("completed");

      const failedLog = await WhatsappMessageLog.findOne({ restaurantId, phone: FAILING_RECIPIENT_PHONE });
      expect(failedLog?.status).toBe("failed");
      expect(failedLog?.failureReason).toMatch(/not a valid WhatsApp user/i);
      expect(failedLog?.metaMessageId).toBeUndefined();
    });

    it("exposes the campaign detail and recipients endpoints", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);
      await Contact.create({ restaurantId, name: "Good", phone: "+919876500009", source: "manual", optedIn: true });

      const created = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Detail Test Broadcast",
        templateId: template._id.toString(),
        audience: { type: "all" },
        bodyParams: ["Asha", "20"],
      });

      const detailRes = await request(app)
        .get(`/api/marketing/campaigns/${created.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.campaign.id).toBe(created.id);

      const recipientsRes = await request(app)
        .get(`/api/marketing/campaigns/${created.id}/recipients`)
        .set("Authorization", `Bearer ${token}`);
      expect(recipientsRes.status).toBe(200);
      expect(recipientsRes.body.recipients).toHaveLength(1);
      expect(recipientsRes.body.recipients[0].status).toBe("sent");
    });
  });

  describe("WhatsApp webhook", () => {
    it("passes the GET verification handshake and echoes the challenge", async () => {
      const res = await request(app)
        .get("/api/public/whatsapp/webhook")
        .query({ "hub.mode": "subscribe", "hub.verify_token": WEBHOOK_VERIFY_TOKEN, "hub.challenge": "challenge-123" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("challenge-123");
    });

    it("rejects the GET handshake with a wrong verify token (403)", async () => {
      const res = await request(app)
        .get("/api/public/whatsapp/webhook")
        .query({ "hub.mode": "subscribe", "hub.verify_token": "wrong-token", "hub.challenge": "challenge-123" });

      expect(res.status).toBe(403);
    });

    it("rejects a POST with no signature header (401)", async () => {
      const res = await request(app)
        .post("/api/public/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_SIGNATURE");
    });

    it("rejects a POST with a wrong/tampered signature (401)", async () => {
      const res = await request(app)
        .post("/api/public/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("X-Hub-Signature-256", "sha256=0000000000000000000000000000000000000000000000000000000000000000")
        .send(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_SIGNATURE");
    });

    it("updates a WhatsappMessageLog row and its parent campaign's counters via a correctly-signed status event", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await connectWhatsapp(restaurantId);
      const template = await createApprovedTemplate(restaurantId);
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      await Contact.create({ restaurantId, name: "Good", phone: "+919876500010", source: "manual", optedIn: true });

      const campaign = await campaignService.createCampaign(restaurantId, owner._id.toString(), {
        name: "Webhook Test Broadcast",
        templateId: template._id.toString(),
        audience: { type: "all" },
        bodyParams: ["Asha", "20"],
      });

      const log = await WhatsappMessageLog.findOne({ restaurantId, campaignId: campaign.id });
      expect(log?.metaMessageId).toBeDefined();
      const metaMessageId = log!.metaMessageId!;

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: PHONE_NUMBER_ID },
                  statuses: [{ id: metaMessageId, status: "delivered" }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex")}`;

      const res = await request(app)
        .post("/api/public/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("X-Hub-Signature-256", signature)
        .send(rawBody);

      expect(res.status).toBe(200);

      const updatedLog = await WhatsappMessageLog.findOne({ restaurantId, metaMessageId });
      expect(updatedLog?.status).toBe("delivered");

      const updatedCampaign = await MarketingCampaign.findById(campaign.id);
      expect(updatedCampaign?.deliveredCount).toBe(1);
    });

    it("no-ops (still 200) on an inbound customer message — Part 3's extension point, not handled yet", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: PHONE_NUMBER_ID },
                  messages: [{ id: "wamid.inbound.1", from: "+919876500099", type: "text" }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex")}`;

      const res = await request(app)
        .post("/api/public/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("X-Hub-Signature-256", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
    });
  });
});
