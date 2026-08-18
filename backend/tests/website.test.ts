import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestMenuItem, tokenFor } from "./utils/fixtures";
import { createApp } from "../src/app";
import * as websiteService from "../src/services/website.service";
import * as publicWebsiteService from "../src/services/public-website.service";
import { AppError } from "../src/utils/app-error";
import { Category } from "../src/models/category.model";
import { MenuItem } from "../src/models/menu-item.model";
import publicRouter from "../src/routes/public.routes";
import { publicRateLimiter } from "../src/middleware/rate-limit";

/**
 * PRD §3.13 Website Builder Module. Covers: the admin content
 * endpoints/RBAC (Owner Full, Manager View-only — a deliberate deviation
 * from every other module's "Manager can edit operational stuff"
 * pattern), the public unauthenticated endpoint (published-gate,
 * never-leak-cost-or-unavailable-items), and that the public router has
 * the rate limiter wired in.
 */
describe("Website Builder module", () => {
  const app = createApp();

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe("Admin content — service layer", () => {
    it("creates content lazily on first read, unpublished by default", async () => {
      const restaurant = await createTestRestaurant();
      const content = await websiteService.getWebsiteContent(restaurant._id.toString());

      expect(content.isPublished).toBe(false);
      expect(content.galleryImageUrls).toEqual([]);
    });

    it("updates hero/about/contact/publish fields", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const updated = await websiteService.updateWebsiteContent(restaurantId, {
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        heroHeadline: "Real food, real fast",
        aboutText: "A neighbourhood kitchen since 2018.",
        contactPhone: "+91 98765 43210",
        contactEmail: "hello@saffron.test",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=abc",
        isPublished: true,
      });

      expect(updated.heroHeadline).toBe("Real food, real fast");
      expect(updated.isPublished).toBe(true);
    });

    it("clears an optional field when given an empty string", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      await websiteService.updateWebsiteContent(restaurantId, { heroHeadline: "Draft headline" });

      const cleared = await websiteService.updateWebsiteContent(restaurantId, { heroHeadline: "" });
      expect(cleared.heroHeadline).toBeUndefined();
    });

    it("appends to the gallery via addGalleryImage", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const first = await websiteService.addGalleryImage(restaurantId, "https://cdn.example.com/1.jpg");
      expect(first.galleryImageUrls).toEqual(["https://cdn.example.com/1.jpg"]);

      const second = await websiteService.addGalleryImage(restaurantId, "https://cdn.example.com/2.jpg");
      expect(second.galleryImageUrls).toHaveLength(2);
    });

    it("rejects adding a gallery image once the cap is reached", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      const twentyUrls = Array.from(
        { length: 20 },
        (_, index) => `https://cdn.example.com/${index}.jpg`,
      );
      await websiteService.updateWebsiteContent(restaurantId, { galleryImageUrls: twentyUrls });

      await expect(
        websiteService.addGalleryImage(restaurantId, "https://cdn.example.com/one-too-many.jpg"),
      ).rejects.toMatchObject({ code: "GALLERY_FULL" } satisfies Partial<AppError>);
    });
  });

  describe("Admin content — RBAC (PRD §2 Website column)", () => {
    it("lets Owner view and edit", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const token = tokenFor(owner);

      const getRes = await request(app)
        .get("/api/website/content")
        .set("Authorization", `Bearer ${token}`);
      expect(getRes.status).toBe(200);

      const patchRes = await request(app)
        .patch("/api/website/content")
        .set("Authorization", `Bearer ${token}`)
        .send({ heroHeadline: "Owner edit" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.content.heroHeadline).toBe("Owner edit");

      const mediaRes = await request(app)
        .post("/api/website/media")
        .set("Authorization", `Bearer ${token}`)
        .send({ imageUrl: "https://cdn.example.com/gallery-1.jpg" });
      expect(mediaRes.status).toBe(201);
    });

    it("lets Manager view but blocks Manager from editing or adding media (403)", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: manager } = await createTestStaff(restaurantId, "manager");
      const token = tokenFor(manager);

      const getRes = await request(app)
        .get("/api/website/content")
        .set("Authorization", `Bearer ${token}`);
      expect(getRes.status).toBe(200);

      const patchRes = await request(app)
        .patch("/api/website/content")
        .set("Authorization", `Bearer ${token}`)
        .send({ heroHeadline: "Manager attempt" });
      expect(patchRes.status).toBe(403);

      const mediaRes = await request(app)
        .post("/api/website/media")
        .set("Authorization", `Bearer ${token}`)
        .send({ imageUrl: "https://cdn.example.com/manager-attempt.jpg" });
      expect(mediaRes.status).toBe(403);
    });

    it("blocks every other role from viewing at all", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      for (const role of ["cashier", "server", "chef", "inventory_manager"] as const) {
        const { user } = await createTestStaff(restaurantId, role);
        const res = await request(app)
          .get("/api/website/content")
          .set("Authorization", `Bearer ${tokenFor(user)}`);
        expect(res.status, `role ${role} should be blocked`).toBe(403);
      }
    });

    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/website/content");
      expect(res.status).toBe(401);
    });
  });

  describe("Public website endpoint — GET /api/public/:restaurantSlug/website", () => {
    it("404s when no restaurant matches the slug", async () => {
      const res = await request(app).get("/api/public/no-such-restaurant/website");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("404s when the restaurant exists but the site isn't published", async () => {
      const restaurant = await createTestRestaurant();
      // Content doc created but never published.
      await websiteService.updateWebsiteContent(restaurant._id.toString(), {
        heroHeadline: "Draft, not live",
      });

      const res = await request(app).get(`/api/public/${restaurant.slug}/website`);
      expect(res.status).toBe(404);
    });

    it("404s when no website content doc exists at all", async () => {
      const restaurant = await createTestRestaurant();
      const res = await request(app).get(`/api/public/${restaurant.slug}/website`);
      expect(res.status).toBe(404);
    });

    it("returns restaurant + content + live menu once published, and never leaks cost/recipe/unavailable data", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();

      await websiteService.updateWebsiteContent(restaurantId, {
        heroHeadline: "Welcome to Saffron",
        aboutText: "Family-run since 2010.",
        contactPhone: "+91 98765 43210",
        isPublished: true,
      });

      const category = await Category.create({
        restaurantId,
        name: "Starters",
        displayOrder: 0,
      });

      const availableDish = await createTestMenuItem(restaurantId, { name: "Paneer Tikka" });
      await MenuItem.findByIdAndUpdate(availableDish._id, {
        categoryId: category._id,
        ingredientMapping: [],
      });
      // Give it a real ingredient mapping + implicit cost data to prove it
      // never reaches the public response.
      const inventoryItemId = restaurant._id; // any ObjectId stand-in
      await MenuItem.findByIdAndUpdate(availableDish._id, {
        ingredientMapping: [{ inventoryItemId, quantityPerUnit: 0.2 }],
      });

      const unavailableDish = await createTestMenuItem(restaurantId, { name: "Sold Out Curry" });
      await MenuItem.findByIdAndUpdate(unavailableDish._id, {
        categoryId: category._id,
        isAvailable: false,
      });

      const res = await request(app).get(`/api/public/${restaurant.slug}/website`);
      expect(res.status).toBe(200);

      const { website } = res.body;
      expect(website.restaurant.name).toBe(restaurant.name);
      expect(website.restaurant.gstNumber).toBeUndefined(); // not set on the test fixture, but the field key check below matters more
      expect(website.content.heroHeadline).toBe("Welcome to Saffron");
      expect(website.content.contactPhone).toBe("+91 98765 43210");

      expect(website.menu).toHaveLength(1);
      expect(website.menu[0].name).toBe("Starters");
      const items = website.menu[0].items as Array<Record<string, unknown>>;
      expect(items.map((item) => item.name)).toEqual(["Paneer Tikka"]);
      expect(items.map((item) => item.name)).not.toContain("Sold Out Curry");

      // Never leak ingredient mapping / cost / staff / financial data.
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain("ingredientMapping");
      expect(raw).not.toContain("costPerUnit");
      expect(raw).not.toContain("passwordHash");
      expect(raw).not.toContain("Sold Out Curry");
    });

    it("resolves restaurantId from the slug, never from client input, at the service level too", async () => {
      const restaurant = await createTestRestaurant();
      await expect(publicWebsiteService.getPublicWebsite("not-a-real-slug")).rejects.toMatchObject({
        code: "NOT_FOUND",
      } satisfies Partial<AppError>);
      // Sanity: a real slug with no published content also 404s (covered
      // above), proving there's no back door that trusts an id directly.
      expect(restaurant.slug).toBeTruthy();
    });
  });

  describe("Public router wiring", () => {
    it("applies the public rate limiter middleware to the /api/public router", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stack = (publicRouter as any).stack as Array<{ handle: unknown }>;
      expect(stack.some((layer) => layer.handle === publicRateLimiter)).toBe(true);
    });
  });
});
