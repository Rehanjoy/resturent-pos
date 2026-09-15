import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Notification } from "../src/models/notification.model";
import { User } from "../src/models/user.model";
import {
  createNotification,
  listGuestNotifications,
  listStaffNotifications,
  markGuestNotificationRead,
  markStaffNotificationRead,
  notifyOrderServed,
  staffUnreadCounts,
} from "../src/services/notification.service";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff } from "./utils/fixtures";

describe("persistent operational notifications", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("deduplicates retried domain events", async () => {
    const restaurant = await createTestRestaurant();
    const input = {
      restaurantId: restaurant.id,
      category: "kitchen" as const,
      eventType: "order_placed",
      title: "New order",
      message: "T1 is waiting.",
      targetRoles: ["chef" as const],
      requiredModule: "kitchen" as const,
      dedupeKey: "kot:123:created",
    };
    await Promise.all([createNotification(input), createNotification(input)]);
    expect(await Notification.countDocuments({ restaurantId: restaurant._id })).toBe(1);
  });

  it("enforces restaurant, role and selected-workspace audience", async () => {
    const restaurant = await createTestRestaurant();
    const otherRestaurant = await createTestRestaurant();
    const { user: chef } = await createTestStaff(restaurant.id, "chef");
    const { user: otherChef } = await createTestStaff(otherRestaurant.id, "chef");
    await User.updateOne({ _id: chef._id }, { $set: { visibleModules: ["orders"] } });
    await createNotification({
      restaurantId: restaurant.id, category: "kitchen", eventType: "order_placed", title: "New order",
      message: "T1 is waiting.", targetRoles: ["chef"], requiredModule: "kitchen", dedupeKey: "kot:workspace:created",
    });

    const hidden = await listStaffNotifications(restaurant.id, chef.id, "chef", { limit: 30 });
    expect(hidden.notifications).toHaveLength(0);
    await User.updateOne({ _id: chef._id }, { $set: { visibleModules: ["orders", "kitchen"] } });
    const visible = await listStaffNotifications(restaurant.id, chef.id, "chef", { limit: 30 });
    expect(visible.notifications).toHaveLength(1);
    const isolated = await listStaffNotifications(otherRestaurant.id, otherChef.id, "chef", { limit: 30 });
    expect(isolated.notifications).toHaveLength(0);
  });

  it("tracks staff and guest read state independently and scopes guest sessions", async () => {
    const restaurant = await createTestRestaurant();
    const { user: server } = await createTestStaff(restaurant.id, "server");
    await createNotification({
      restaurantId: restaurant.id, category: "service", eventType: "service_help_requested", title: "Help",
      message: "Guest needs help.", targetRoles: ["server"], requiredModule: "tables",
      targetDiningSessionId: "session-a", dedupeKey: "service:help:created",
    });

    const staffPage = await listStaffNotifications(restaurant.id, server.id, "server", { limit: 30 });
    const notificationId = staffPage.notifications[0]!.id;
    expect((await staffUnreadCounts(restaurant.id, server.id, "server")).total).toBe(1);
    await markStaffNotificationRead(restaurant.id, server.id, "server", notificationId);
    expect((await staffUnreadCounts(restaurant.id, server.id, "server")).total).toBe(0);

    expect((await listGuestNotifications(restaurant.id, "session-b", { limit: 30 })).notifications).toHaveLength(0);
    const guestPage = await listGuestNotifications(restaurant.id, "session-a", { limit: 30 });
    expect(guestPage.unreadCount).toBe(1);
    await markGuestNotificationRead(restaurant.id, "session-a", notificationId);
    expect((await listGuestNotifications(restaurant.id, "session-a", { limit: 30 })).unreadCount).toBe(0);
  });

  it("names served items in the guest-facing message, capped after four", async () => {
    const restaurant = await createTestRestaurant();
    notifyOrderServed({
      restaurantId: restaurant.id,
      orderId: new Types.ObjectId().toString(),
      serveKey: "item-1:item-2",
      diningSessionId: "session-served",
      tableLabel: "T1",
      items: [{ name: "Chicken Biryani", qty: 2 }, { name: "Chicken Chilli", qty: 1 }],
      itemCount: 3,
      allServed: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const partial = await Notification.findOne({ restaurantId: restaurant._id, targetDiningSessionId: "session-served" });
    expect(partial?.message).toBe("2× Chicken Biryani, 1× Chicken Chilli served. Remaining items stay on the live tracker.");

    notifyOrderServed({
      restaurantId: restaurant.id,
      orderId: new Types.ObjectId().toString(),
      serveKey: "item-3:item-4:item-5:item-6:item-7",
      diningSessionId: "session-served-full",
      tableLabel: "T1",
      items: [{ name: "Dish A", qty: 1 }, { name: "Dish B", qty: 1 }, { name: "Dish C", qty: 1 }, { name: "Dish D", qty: 1 }, { name: "Dish E", qty: 1 }],
      itemCount: 5,
      allServed: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const full = await Notification.findOne({ restaurantId: restaurant._id, targetDiningSessionId: "session-served-full" });
    expect(full?.message).toBe("1× Dish A, 1× Dish B, 1× Dish C, 1× Dish D +1 more served. Your order is complete — open the menu to add more items.");
  });
});
