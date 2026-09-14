import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Notification } from "../src/models/notification.model";
import { User } from "../src/models/user.model";
import {
  createNotification,
  listGuestNotifications,
  listStaffNotifications,
  markGuestNotificationRead,
  markStaffNotificationRead,
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
});
