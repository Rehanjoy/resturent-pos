import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, tokenFor } from "./utils/fixtures";
import { AppError } from "../src/utils/app-error";

// Stubs Meta's Graph API — these tests must never make a real network call.
// `accessToken === "invalid-token"` simulates Meta rejecting a bad
// phoneNumberId/accessToken pair, exercising `saveWhatsappConfig`'s
// "don't save broken config" path.
vi.mock("../src/lib/whatsapp/meta-api", () => ({
  verifyPhoneNumber: vi.fn(
    async ({ phoneNumberId, accessToken }: { phoneNumberId: string; accessToken: string }) => {
      if (accessToken === "invalid-token") {
        throw new Error("Error validating access token: Session has expired.");
      }
      return {
        id: phoneNumberId,
        displayPhoneNumber: "+91 98765 43210",
        verifiedName: "Saffron Test Kitchen",
        qualityRating: "GREEN",
      };
    },
  ),
}));

import { createApp } from "../src/app";
import { WhatsappConfig } from "../src/models/whatsapp-config.model";
import { Contact } from "../src/models/contact.model";
import * as whatsappConfigService from "../src/services/whatsapp-config.service";
import * as contactService from "../src/services/contact.service";

/**
 * Marketing module, Part 1 of 3 (WhatsApp connection config + Contacts).
 * Covers: RBAC (Owner/Manager-only module; WhatsApp connect is
 * Owner-only edit, mirroring Website Builder's split), the
 * verify-before-save WhatsApp connect flow, encryption-at-rest never
 * leaking the plaintext token, E.164 phone validation, and CSV import's
 * find-or-create-by-phone + tag-merge + per-row rejection reporting.
 */
describe("Marketing module (Part 1: WhatsApp config + Contacts)", () => {
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

  describe("WhatsApp config — RBAC", () => {
    it("lets Owner view and connect", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const getBefore = await request(app)
        .get("/api/marketing/whatsapp-config")
        .set("Authorization", `Bearer ${token}`);
      expect(getBefore.status).toBe(200);
      expect(getBefore.body.config).toBeNull();

      const patchRes = await request(app)
        .patch("/api/marketing/whatsapp-config")
        .set("Authorization", `Bearer ${token}`)
        .send({ phoneNumberId: "1234567890", accessToken: "a-valid-looking-test-token-value" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.config.isConnected).toBe(true);
      expect(patchRes.body.config.verifiedName).toBe("Saffron Test Kitchen");
      expect(patchRes.body.config.displayPhoneNumber).toBe("+91 98765 43210");
      // Never returned to the client, encrypted or otherwise.
      expect(patchRes.body.config.accessToken).toBeUndefined();
      expect(patchRes.body.config.accessTokenEncrypted).toBeUndefined();
    });

    it("lets Manager view but blocks Manager from connecting/editing (403)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: manager } = await createTestStaff(restaurantId, "manager");
      const token = tokenFor(manager);

      const getRes = await request(app)
        .get("/api/marketing/whatsapp-config")
        .set("Authorization", `Bearer ${token}`);
      expect(getRes.status).toBe(200);

      const patchRes = await request(app)
        .patch("/api/marketing/whatsapp-config")
        .set("Authorization", `Bearer ${token}`)
        .send({ phoneNumberId: "1234567890", accessToken: "manager-attempt-token-value" });
      expect(patchRes.status).toBe(403);
    });

    it("blocks every other role from even viewing the module (403)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const token = tokenFor(user);

        const configRes = await request(app)
          .get("/api/marketing/whatsapp-config")
          .set("Authorization", `Bearer ${token}`);
        expect(configRes.status, `role ${role} should be blocked from whatsapp-config`).toBe(403);

        const contactsRes = await request(app)
          .get("/api/marketing/contacts")
          .set("Authorization", `Bearer ${token}`);
        expect(contactsRes.status, `role ${role} should be blocked from contacts`).toBe(403);
      }
    });

    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/marketing/whatsapp-config");
      expect(res.status).toBe(401);
    });
  });

  describe("WhatsApp config — verify-before-save + encryption", () => {
    it("rejects the save and does not persist anything when Meta rejects the pair", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await expect(
        whatsappConfigService.saveWhatsappConfig(restaurantId, {
          phoneNumberId: "1234567890",
          accessToken: "invalid-token",
        }),
      ).rejects.toMatchObject({ code: "WHATSAPP_VERIFICATION_FAILED" } satisfies Partial<AppError>);

      const stored = await WhatsappConfig.findOne({ restaurantId });
      expect(stored).toBeNull();
    });

    it("encrypts the access token at rest and never selects it back by default", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const plaintextToken = "a-real-looking-permanent-meta-access-token";

      await whatsappConfigService.saveWhatsappConfig(restaurantId, {
        phoneNumberId: "1234567890",
        accessToken: plaintextToken,
      });

      const defaultRead = await WhatsappConfig.findOne({ restaurantId });
      // `select: false` on the schema — the field is absent unless opted in.
      expect(defaultRead?.accessTokenEncrypted).toBeUndefined();

      const withSecret = await WhatsappConfig.findOne({ restaurantId }).select("+accessTokenEncrypted");
      expect(withSecret?.accessTokenEncrypted).toBeDefined();
      expect(withSecret?.accessTokenEncrypted).not.toBe(plaintextToken);
      expect(withSecret?.accessTokenEncrypted).not.toContain(plaintextToken);
    });

    it("upserts (reconnecting updates the same one-per-restaurant document)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await whatsappConfigService.saveWhatsappConfig(restaurantId, {
        phoneNumberId: "111",
        accessToken: "first-token-value",
      });
      await whatsappConfigService.saveWhatsappConfig(restaurantId, {
        phoneNumberId: "222",
        accessToken: "second-token-value",
      });

      const count = await WhatsappConfig.countDocuments({ restaurantId });
      expect(count).toBe(1);
      const config = await WhatsappConfig.findOne({ restaurantId });
      expect(config?.phoneNumberId).toBe("222");
    });
  });

  describe("Contacts — E.164 phone validation", () => {
    it("rejects a malformed phone number at the API edge (400)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .post("/api/marketing/contacts")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bad Phone Contact", phone: "9876543210" }); // missing leading "+"
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("accepts a valid E.164 phone number", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const res = await request(app)
        .post("/api/marketing/contacts")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Asha Rao", phone: "+919876543210" });
      expect(res.status).toBe(201);
      expect(res.body.contact.phone).toBe("+919876543210");
      expect(res.body.contact.source).toBe("manual");
      expect(res.body.contact.optedIn).toBe(true);
    });
  });

  describe("Contacts — CSV import", () => {
    it("find-or-creates by phone, merging tags (union, not overwrite) rather than duplicating", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const existing = await Contact.create({
        restaurantId,
        name: "Old Name",
        phone: "+919876500001",
        tags: ["loyal"],
        source: "manual",
      });

      const csv = [
        "name,phone,email,tags",
        "New Name For Same Phone,+919876500001,new@example.com,vip",
      ].join("\n");

      const result = await contactService.importContactsFromCsv(restaurantId, csv);
      expect(result.imported).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.rejected).toEqual([]);

      const countForPhone = await Contact.countDocuments({ restaurantId, phone: "+919876500001" });
      expect(countForPhone).toBe(1); // never duplicated

      const updated = await Contact.findById(existing._id);
      expect(updated?.name).toBe("New Name For Same Phone");
      expect(updated?.tags.sort()).toEqual(["loyal", "vip"].sort());
    });

    it("reports rejected rows with a reason instead of silently dropping them", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const csv = [
        "name,phone,email,tags",
        "Valid Contact,+919876500002,,",
        ",+919876500003,,", // missing name
        "Bad Phone Contact,12345,,", // not E.164
      ].join("\n");

      const result = await contactService.importContactsFromCsv(restaurantId, csv);
      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.rejected).toHaveLength(2);
      expect(result.rejected.map((r) => r.row)).toEqual([3, 4]);
      expect(result.rejected[0]?.reason).toMatch(/name/i);
      expect(result.rejected[1]?.reason).toMatch(/phone/i);
    });

    it("splits the tags cell on semicolon, not comma", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const csv = ["name,phone,email,tags", "Tag Test,+919876500004,,vip;regular;weekend"].join("\n");
      await contactService.importContactsFromCsv(restaurantId, csv);

      const contact = await Contact.findOne({ restaurantId, phone: "+919876500004" });
      expect(contact?.tags.sort()).toEqual(["regular", "vip", "weekend"].sort());
    });

    it("rejects a CSV missing the required name/phone header columns", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await expect(
        contactService.importContactsFromCsv(restaurantId, "foo,bar\n1,2"),
      ).rejects.toMatchObject({ code: "INVALID_CSV_HEADER" } satisfies Partial<AppError>);
    });

    it("uploads via the HTTP endpoint and returns the per-row summary", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const csv = [
        "name,phone,email,tags",
        "Uploaded Contact,+919876500005,uploaded@example.com,vip",
        "No Phone Row,,,",
      ].join("\n");

      const res = await request(app)
        .post("/api/marketing/contacts/import")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from(csv, "utf8"), "contacts.csv");

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(1);
      expect(res.body.updated).toBe(0);
      expect(res.body.rejected).toHaveLength(1);
    });

    it("rejects the import request when Manager attempts it under a role with no contacts access", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: cashier } = await createTestStaff(restaurantId, "cashier");
      const token = tokenFor(cashier);

      const res = await request(app)
        .post("/api/marketing/contacts/import")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("name,phone\nA,+919876500006", "utf8"), "contacts.csv");
      expect(res.status).toBe(403);
    });
  });

  describe("Contacts — duplicate phone rejected on manual create", () => {
    it("rejects creating a second contact with the same phone (409)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      await request(app)
        .post("/api/marketing/contacts")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "First", phone: "+919876500007" });

      const res = await request(app)
        .post("/api/marketing/contacts")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Second", phone: "+919876500007" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("DUPLICATE_CONTACT_PHONE");
    });
  });
});
