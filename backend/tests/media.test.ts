import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, tokenFor } from "./utils/fixtures";

describe("menu image media", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("stores an authenticated image and serves it publicly with safe headers", async () => {
    const restaurant = await createTestRestaurant();
    const { user } = await createTestStaff(restaurant.id, "owner");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const uploaded = await request(createApp())
      .post("/api/media/menu-image")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .attach("image", png, { filename: "dish.png", contentType: "image/png" });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.imageUrl).toMatch(/\/api\/public\/media\/[a-f0-9]{24}$/);
    const pathname = new URL(uploaded.body.imageUrl).pathname;
    const served = await request(createApp()).get(pathname);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
    expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.compare(served.body as Buffer, png)).toBe(0);
  });

  it("rejects files outside the supported image formats", async () => {
    const restaurant = await createTestRestaurant();
    const { user } = await createTestStaff(restaurant.id, "owner");
    const response = await request(createApp())
      .post("/api/media/menu-image")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .attach("image", Buffer.from("not an image"), { filename: "dish.txt", contentType: "text/plain" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_IMAGE_TYPE");
  });
});
