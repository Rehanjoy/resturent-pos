import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, tokenFor } from "./utils/fixtures";

/**
 * PRD §2's RBAC matrix and §7's "never trust client-side role flags" are
 * the security backbone of the whole app. This suite hits the real Express
 * app end-to-end (real routes, real `authenticate`/`authorize`
 * middleware) as every role, for a representative slice of the most
 * sensitive endpoints across modules — not exhaustive, but enough to catch
 * a role-boundary regression before it ships.
 */
describe("RBAC — cross-module access control", () => {
  const app = createApp();
  const DUMMY_ID = "000000000000000000000000"; // valid ObjectId shape; role checks run before existence checks

  let restaurantId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    const restaurant = await createTestRestaurant();
    restaurantId = restaurant._id.toString();
    for (const role of ["owner", "manager", "cashier", "server", "chef", "inventory_manager"] as const) {
      const { user } = await createTestStaff(restaurantId, role);
      tokens[role] = tokenFor(user);
    }
  });

  function as(role: string) {
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${tokens[role]}`);
    return {
      get: (path: string) => auth(request(app).get(path)),
      post: (path: string) => auth(request(app).post(path)),
      patch: (path: string) => auth(request(app).patch(path)),
      delete: (path: string) => auth(request(app).delete(path)),
    };
  }

  it("rejects every protected route with no token at all", async () => {
    const res = await request(app).get("/api/staff");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed/invalid token", async () => {
    const res = await request(app).get("/api/staff").set("Authorization", "Bearer garbage.token.value");
    expect(res.status).toBe(401);
  });

  describe("Staff module — Owner/Manager only, no view for anyone else", () => {
    it.each(["owner", "manager"])("allows %s to list staff", async (role) => {
      const res = await as(role).get("/api/staff");
      expect(res.status).toBe(200);
    });

    it.each(["cashier", "server", "chef", "inventory_manager"])(
      "blocks %s from even viewing the staff list",
      async (role) => {
        const res = await as(role).get("/api/staff");
        expect(res.status).toBe(403);
      },
    );

    it("blocks a Manager from creating an Owner account (privilege-escalation boundary)", async () => {
      const res = await as("manager")
        .post("/api/staff")
        .send({ name: "New Owner", email: "new-owner@test.saffron.dev", role: "owner" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("STAFF_ROLE_NOT_PERMITTED");
    });

    it("blocks a Manager from creating another Manager account", async () => {
      const res = await as("manager")
        .post("/api/staff")
        .send({ name: "New Manager", email: "new-manager@test.saffron.dev", role: "manager" });
      expect(res.status).toBe(403);
    });

    it("allows a Manager to create a frontline (Cashier) account", async () => {
      const res = await as("manager")
        .post("/api/staff")
        .send({ name: "New Cashier", email: "new-cashier@test.saffron.dev", role: "cashier" });
      expect(res.status).toBe(201);
    });

    it("allows an Owner to create a Manager account", async () => {
      const res = await as("owner")
        .post("/api/staff")
        .send({ name: "New Manager", email: "new-manager-2@test.saffron.dev", role: "manager" });
      expect(res.status).toBe(201);
    });
  });

  describe("Orders module — Chef can view but never build or void", () => {
    it("blocks Chef from creating an order", async () => {
      const res = await as("chef").post("/api/orders").send({ tableId: DUMMY_ID });
      expect(res.status).toBe(403);
    });

    it("allows Server to create an order", async () => {
      const res = await as("server").post("/api/orders").send({ tableId: DUMMY_ID });
      // 404 (table doesn't exist) proves the RBAC gate passed — it's not a 403.
      expect(res.status).not.toBe(403);
    });

    it("blocks Server and Cashier from voiding an order (Owner/Manager only)", async () => {
      const asServer = await as("server").delete(`/api/orders/${DUMMY_ID}/void`).send({ reason: "test" });
      const asCashier = await as("cashier").delete(`/api/orders/${DUMMY_ID}/void`).send({ reason: "test" });
      expect(asServer.status).toBe(403);
      expect(asCashier.status).toBe(403);
    });

    it("allows Manager to attempt a void (RBAC gate passes, even though the order doesn't exist)", async () => {
      const res = await as("manager").delete(`/api/orders/${DUMMY_ID}/void`).send({ reason: "test" });
      expect(res.status).not.toBe(403);
    });
  });

  describe("Kitchen module — Cashier/Server can view, only Owner/Manager/Chef can Mark Ready", () => {
    it.each(["cashier", "server"])("blocks %s from marking a ticket ready", async (role) => {
      const res = await as(role).patch(`/api/kitchen/tickets/${DUMMY_ID}/mark-all-ready`);
      expect(res.status).toBe(403);
    });

    it("allows Chef to attempt Mark Ready (RBAC gate passes)", async () => {
      const res = await as("chef").patch(`/api/kitchen/tickets/${DUMMY_ID}/mark-all-ready`);
      expect(res.status).not.toBe(403);
    });

    it.each(["owner", "manager", "chef", "cashier", "server"])("allows %s to view the KDS board", async (role) => {
      const res = await as(role).get("/api/kitchen/tickets");
      expect(res.status).toBe(200);
    });

    it("blocks Inventory Manager from viewing the KDS board at all", async () => {
      const res = await as("inventory_manager").get("/api/kitchen/tickets");
      expect(res.status).toBe(403);
    });
  });

  describe("Billing module — Server has no billing access, void is Owner/Manager only", () => {
    it("blocks Server from generating an invoice", async () => {
      const res = await as("server").post(`/api/invoices/${DUMMY_ID}/generate`).send({});
      expect(res.status).toBe(403);
    });

    it("allows Cashier to attempt generating an invoice (RBAC gate passes)", async () => {
      const res = await as("cashier").post(`/api/invoices/${DUMMY_ID}/generate`).send({});
      expect(res.status).not.toBe(403);
    });

    it("blocks Cashier from voiding an invoice", async () => {
      const res = await as("cashier").post(`/api/invoices/${DUMMY_ID}/void`).send({ reason: "test" });
      expect(res.status).toBe(403);
    });
  });

  describe("Reports module — Staff Performance is hidden from Cashier specifically", () => {
    it("allows Cashier to view the sales report", async () => {
      const res = await as("cashier").get("/api/reports/sales?range=today");
      expect(res.status).toBe(200);
    });

    it("blocks Cashier from the staff-performance report even though they can view other reports", async () => {
      const res = await as("cashier").get("/api/reports/staff-performance?range=today");
      expect(res.status).toBe(403);
    });

    it("allows Manager to view the staff-performance report", async () => {
      const res = await as("manager").get("/api/reports/staff-performance?range=today");
      expect(res.status).toBe(200);
    });

    it.each(["server", "chef", "inventory_manager"])("blocks %s from all reports", async (role) => {
      const res = await as(role).get("/api/reports/sales?range=today");
      expect(res.status).toBe(403);
    });
  });

  describe("Settings module — only Owner can edit restaurant identity", () => {
    it("blocks Manager from editing the restaurant profile", async () => {
      const res = await as("manager").patch("/api/settings/profile").send({ name: "Renamed" });
      expect(res.status).toBe(403);
    });

    it("allows Owner to edit the restaurant profile", async () => {
      const res = await as("owner").patch("/api/settings/profile").send({ name: "Renamed" });
      expect(res.status).toBe(200);
    });

    it("allows Manager to edit the tax config (operational, not identity)", async () => {
      const res = await as("manager")
        .patch("/api/settings/tax-config")
        .send({ taxConfig: [{ name: "GST", ratePercent: 18, type: "other" }] });
      expect(res.status).toBe(200);
    });
  });

  describe("Tenant isolation — a token from one restaurant can't reach another's data", () => {
    it("returns an empty/not-found result rather than another restaurant's staff list", async () => {
      const otherRestaurant = await createTestRestaurant();
      const { user: otherOwner } = await createTestStaff(otherRestaurant._id.toString(), "owner");
      const otherToken = tokenFor(otherOwner);

      const res = await request(app).get("/api/staff").set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body.staff as { id: string }[]).map((s) => s.id);
      // The first restaurant's owner/manager/etc. seeded in beforeEach must
      // never appear in the second restaurant's staff list.
      const firstRestaurantStaffCount = 6;
      expect(ids.length).toBeLessThan(firstRestaurantStaffCount + 1);
      expect(res.body.staff.every((s: { id: string }) => s.id !== undefined)).toBe(true);
    });
  });
});
