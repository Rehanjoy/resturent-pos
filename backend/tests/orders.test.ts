import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestMenuItem, createTestTable } from "./utils/fixtures";
import * as orderService from "../src/services/order.service";
import * as kitchenService from "../src/services/kitchen.service";
import { AppError } from "../src/utils/app-error";
import { Table } from "../src/models/table.model";
import { AuditLog } from "../src/models/audit-log.model";

/**
 * PRD goals: "Zero data loss, zero double-billing, zero order-mismatch
 * between POS and Kitchen." This suite exercises the order state machine
 * (Draft -> Sent/In-Kitchen -> Ready -> Served -> Void) against a real
 * in-memory MongoDB, including the split-order (multiple KOTs per order)
 * path PRD §3.3 explicitly calls out.
 */
describe("Order lifecycle & Kitchen Display System", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function setup() {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: server } = await createTestStaff(restaurantId, "server");
    const menuItem = await createTestMenuItem(restaurantId);
    const table = await createTestTable(restaurantId);
    return { restaurantId, server, menuItem, table };
  }

  it("occupies the table when an order is created, and frees it back up on void", async () => {
    const { restaurantId, server, table } = await setup();

    const { order, created } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    expect(created).toBe(true);
    expect(order.status).toBe("draft");

    const occupied = await Table.findById(table._id);
    expect(occupied?.status).toBe("occupied");

    await orderService.voidOrder(restaurantId, server._id.toString(), order.id, "Guest left");

    const freed = await Table.findById(table._id);
    expect(freed?.status).toBe("free");
  });

  it("returns the existing draft instead of erroring if the table already has one", async () => {
    const { restaurantId, server, table } = await setup();
    const first = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    const second = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
  });

  it("refuses a new order on a table that's occupied by someone else's order with no active order to return", async () => {
    const { restaurantId, server, table } = await setup();
    await Table.updateOne({ _id: table._id }, { status: "reserved" }); // occupied by a reservation, no order
    await expect(
      orderService.createOrder(restaurantId, server._id.toString(), table._id.toString()),
    ).rejects.toMatchObject({ code: "TABLE_NOT_FREE" } satisfies Partial<AppError>);
  });

  it("moves items from pending -> sent on send-to-kitchen, and creates a KOT", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });

    const { order: sentOrder, kot } = await orderService.sendToKitchen(restaurantId, order.id);
    expect(sentOrder.status).toBe("sent");
    expect(sentOrder.items[0]?.itemStatus).toBe("sent");
    expect(kot.items).toHaveLength(1);
  });

  it("refuses to send to kitchen when there's nothing pending", async () => {
    const { restaurantId, server, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await expect(orderService.sendToKitchen(restaurantId, order.id)).rejects.toMatchObject({
      code: "NOTHING_TO_SEND",
    } satisfies Partial<AppError>);
  });

  it("supports split orders: a second send-to-kitchen batch creates a second KOT and moves the order to in_kitchen", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const first = await orderService.sendToKitchen(restaurantId, order.id);
    expect(first.order.status).toBe("sent");

    // Guest orders dessert after the mains already went to the kitchen.
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const second = await orderService.sendToKitchen(restaurantId, order.id);
    expect(second.order.status).toBe("in_kitchen"); // not "sent" again — a KOT already existed
    expect(second.kot.id).not.toBe(first.kot.id); // a distinct second ticket, not merged into the first

    const active = await kitchenService.listActiveTickets(restaurantId);
    expect(active.filter((t) => t.orderId === order.id)).toHaveLength(2);
  });

  it("only advances the order to ready once every KOT for it is fully ready", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const { kot: kot1 } = await orderService.sendToKitchen(restaurantId, order.id);
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const { kot: kot2 } = await orderService.sendToKitchen(restaurantId, order.id);

    await kitchenService.markAllReady(restaurantId, kot1.id);
    let current = await orderService.getOrder(restaurantId, order.id);
    expect(current.status).toBe("in_kitchen"); // kot2 still outstanding — not ready yet

    await kitchenService.markAllReady(restaurantId, kot2.id);
    current = await orderService.getOrder(restaurantId, order.id);
    expect(current.status).toBe("ready"); // both KOTs done now
  });

  it("clears a ticket from the active KDS queue only on Serve, not on Mark Ready", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const { kot } = await orderService.sendToKitchen(restaurantId, order.id);
    await kitchenService.markAllReady(restaurantId, kot.id);

    const stillOnBoard = await kitchenService.listActiveTickets(restaurantId);
    expect(stillOnBoard.some((t) => t.id === kot.id)).toBe(true); // PRD §3.4: clears on Serve, not Mark Ready

    await orderService.serveOrder(restaurantId, server._id.toString(), order.id);
    const afterServe = await kitchenService.listActiveTickets(restaurantId);
    expect(afterServe.some((t) => t.id === kot.id)).toBe(false);
  });

  it("refuses to serve when nothing is ready yet", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    await orderService.sendToKitchen(restaurantId, order.id); // sent, but not marked ready
    await expect(
      orderService.serveOrder(restaurantId, server._id.toString(), order.id),
    ).rejects.toMatchObject({ code: "NOTHING_TO_SERVE" } satisfies Partial<AppError>);
  });

  it("blocks editing items that have already been sent to the kitchen", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const { order: sentOrder } = await orderService.sendToKitchen(restaurantId, order.id);
    const sentItemId = sentOrder.items[0]!.id;

    await expect(
      orderService.editOrderItems(restaurantId, order.id, {
        updateItems: [{ itemId: sentItemId, qty: 5 }],
      }),
    ).rejects.toThrow(); // a sent item is immutable — corrections go through void, not silent edit
  });

  it("rejects adding a sold-out (unavailable) menu item", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { MenuItem } = await import("../src/models/menu-item.model");
    await MenuItem.updateOne({ _id: menuItem._id }, { isAvailable: false });

    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await expect(
      orderService.editOrderItems(restaurantId, order.id, {
        addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
      }),
    ).rejects.toThrow();
  });

  it("writes an audit log entry with a reason when an order is voided", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });

    await orderService.voidOrder(restaurantId, server._id.toString(), order.id, "Kitchen ran out of this dish");

    const logs = await AuditLog.find({ restaurantId, entityId: order.id, action: "order.void" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.afterValue).toMatchObject({ status: "void", reason: "Kitchen ran out of this dish" });
  });

  it("refuses to void an order that's already billed", async () => {
    const { restaurantId, server, menuItem, table } = await setup();
    const { order } = await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });
    const { kot } = await orderService.sendToKitchen(restaurantId, order.id);
    await kitchenService.markAllReady(restaurantId, kot.id);
    await orderService.serveOrder(restaurantId, server._id.toString(), order.id);

    const invoiceService = await import("../src/services/invoice.service");
    await invoiceService.generateInvoice(restaurantId, server._id.toString(), order.id, {});

    await expect(
      orderService.voidOrder(restaurantId, server._id.toString(), order.id, "too late"),
    ).rejects.toMatchObject({ code: "ORDER_NOT_VOIDABLE" } satisfies Partial<AppError>);
  });
});
