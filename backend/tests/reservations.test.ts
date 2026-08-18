import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestTable, tokenFor } from "./utils/fixtures";
import * as reservationService from "../src/services/reservation.service";
import * as orderService from "../src/services/order.service";
import { AppError } from "../src/utils/app-error";
import { Table } from "../src/models/table.model";
import request from "supertest";
import { createApp } from "../src/app";

/**
 * PRD §3.7 Reservation Management. Covers the model, the CRUD/seat
 * endpoints, and — the core design decision of this module — the
 * event-triggered table-hold logic (no job scheduler in this codebase, so
 * the PRD's "reservation time ± buffer window" auto-hold is approximated by
 * concrete staff actions instead; see the doc comment above
 * `reservation.service.ts` `createReservation`).
 */
describe("Reservation management & table-hold logic", () => {
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
    const table = await createTestTable(restaurantId);
    return { restaurantId, server, table };
  }

  const reservationTimeInput = () => new Date(Date.now() + 3_600_000).toISOString();

  it("holds the assigned table (sets it to reserved) when a confirmed reservation is created", async () => {
    const { restaurantId, server, table } = await setup();

    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Asha Rao",
      guestPhone: "9999900000",
      partySize: 4,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });
    expect(reservation.status).toBe("confirmed");
    expect(reservation.tableId).toBe(table._id.toString());

    const updatedTable = await Table.findById(table._id);
    expect(updatedTable?.status).toBe("reserved");
  });

  it("also holds the table for a waitlist reservation, not only confirmed", async () => {
    const { restaurantId, server, table } = await setup();

    await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Waitlist Guest",
      guestPhone: "9999900001",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
      status: "waitlist",
    });

    const updatedTable = await Table.findById(table._id);
    expect(updatedTable?.status).toBe("reserved");
  });

  it("creates a reservation with no table with no error and no table-status side effect", async () => {
    const { restaurantId, server, table } = await setup();

    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "No Table Yet",
      guestPhone: "9999900002",
      partySize: 2,
      reservationTime: reservationTimeInput(),
    });
    expect(reservation.tableId).toBeUndefined();

    const unchangedTable = await Table.findById(table._id);
    expect(unchangedTable?.status).toBe("free");
  });

  it("rejects assigning a table that already has an active order", async () => {
    const { restaurantId, server, table } = await setup();
    await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());

    await expect(
      reservationService.createReservation(restaurantId, server._id.toString(), {
        guestName: "Blocked Guest",
        guestPhone: "9999900003",
        partySize: 2,
        reservationTime: reservationTimeInput(),
        tableId: table._id.toString(),
      }),
    ).rejects.toMatchObject({ code: "TABLE_HAS_ACTIVE_ORDER" } satisfies Partial<AppError>);
  });

  it("rejects assigning a table that's already held by a different active reservation", async () => {
    const { restaurantId, server, table } = await setup();
    await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "First Guest",
      guestPhone: "9999900004",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await expect(
      reservationService.createReservation(restaurantId, server._id.toString(), {
        guestName: "Second Guest",
        guestPhone: "9999900005",
        partySize: 3,
        reservationTime: reservationTimeInput(),
        tableId: table._id.toString(),
      }),
    ).rejects.toMatchObject({ code: "TABLE_ALREADY_RESERVED" } satisfies Partial<AppError>);
  });

  it("moves the hold to a new table and releases the old one when the table assignment is edited", async () => {
    const { restaurantId, server, table } = await setup();
    const secondTable = await createTestTable(restaurantId);

    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Moving Guest",
      guestPhone: "9999900006",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await reservationService.updateReservation(restaurantId, reservation.id, {
      tableId: secondTable._id.toString(),
    });

    const oldTable = await Table.findById(table._id);
    const newTable = await Table.findById(secondTable._id);
    expect(oldTable?.status).toBe("free");
    expect(newTable?.status).toBe("reserved");
  });

  it("releases the table hold when the table assignment is removed from an active reservation", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Unassign Guest",
      guestPhone: "9999900007",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await reservationService.updateReservation(restaurantId, reservation.id, { tableId: null });

    const freedTable = await Table.findById(table._id);
    expect(freedTable?.status).toBe("free");
  });

  it("seats a reservation: moves the reservation to seated and the table to occupied", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Seat Me",
      guestPhone: "9999900008",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    const seated = await reservationService.seatReservation(restaurantId, reservation.id, {});
    expect(seated.status).toBe("seated");

    const seatedTable = await Table.findById(table._id);
    expect(seatedTable?.status).toBe("occupied");
  });

  it("does not itself create an Order when seating a reservation", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "No Order Yet",
      guestPhone: "9999900009",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await reservationService.seatReservation(restaurantId, reservation.id, {});

    const orders = await orderService.listOrders(restaurantId, {});
    expect(orders).toHaveLength(0);
  });

  it("lets staff pick a table at the moment of seating if none was assigned yet", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Pick At Seat",
      guestPhone: "9999900010",
      partySize: 2,
      reservationTime: reservationTimeInput(),
    });

    const seated = await reservationService.seatReservation(restaurantId, reservation.id, {
      tableId: table._id.toString(),
    });
    expect(seated.tableId).toBe(table._id.toString());

    const seatedTable = await Table.findById(table._id);
    expect(seatedTable?.status).toBe("occupied");
  });

  it("rejects seating with no table assigned and none provided", async () => {
    const { restaurantId, server } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "No Table",
      guestPhone: "9999900011",
      partySize: 2,
      reservationTime: reservationTimeInput(),
    });

    await expect(
      reservationService.seatReservation(restaurantId, reservation.id, {}),
    ).rejects.toMatchObject({ code: "TABLE_REQUIRED" } satisfies Partial<AppError>);
  });

  it("frees the table on cancel, but only when nothing else is using it", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Cancel Guest",
      guestPhone: "9999900012",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await reservationService.updateReservation(restaurantId, reservation.id, { status: "cancelled" });

    const freedTable = await Table.findById(table._id);
    expect(freedTable?.status).toBe("free");
  });

  it("frees the table on no-show", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "No Show Guest",
      guestPhone: "9999900013",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    await reservationService.updateReservation(restaurantId, reservation.id, { status: "no_show" });

    const freedTable = await Table.findById(table._id);
    expect(freedTable?.status).toBe("free");
  });

  it("does not free the table on cancel if another active order has since taken it over", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Overtaken Guest",
      guestPhone: "9999900014",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });

    // Table is "reserved" (not "free"), so this simulates staff manually
    // walking a party in and starting an order on it directly — an edge
    // case, but one the release logic must not clobber.
    await Table.updateOne({ _id: table._id }, { status: "free" });
    await orderService.createOrder(restaurantId, server._id.toString(), table._id.toString());

    await reservationService.updateReservation(restaurantId, reservation.id, { status: "cancelled" });

    const stillOccupied = await Table.findById(table._id);
    expect(stillOccupied?.status).toBe("occupied");
  });

  it("blocks editing a reservation once it's seated/cancelled/no-show", async () => {
    const { restaurantId, server, table } = await setup();
    const reservation = await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Terminal Guest",
      guestPhone: "9999900015",
      partySize: 2,
      reservationTime: reservationTimeInput(),
      tableId: table._id.toString(),
    });
    await reservationService.seatReservation(restaurantId, reservation.id, {});

    await expect(
      reservationService.updateReservation(restaurantId, reservation.id, { partySize: 5 }),
    ).rejects.toMatchObject({ code: "RESERVATION_NOT_EDITABLE" } satisfies Partial<AppError>);
  });

  it("filters the list to a single calendar day via the date query param", async () => {
    const { restaurantId, server } = await setup();
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 3_600_000);

    await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Today Guest",
      guestPhone: "9999900016",
      partySize: 2,
      reservationTime: new Date(today.setHours(19, 0, 0, 0)).toISOString(),
    });
    await reservationService.createReservation(restaurantId, server._id.toString(), {
      guestName: "Tomorrow Guest",
      guestPhone: "9999900017",
      partySize: 2,
      reservationTime: new Date(tomorrow.setHours(19, 0, 0, 0)).toISOString(),
    });

    // Built from local getters (not `toISOString()`, which is UTC) to match
    // `reservation.service.ts` `listReservations`, which interprets the
    // `date` filter in the server process's local time zone.
    const now = new Date();
    const todayDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const results = await reservationService.listReservations(restaurantId, { date: todayDateString });
    expect(results).toHaveLength(1);
    expect(results[0]?.guestName).toBe("Today Guest");
  });

  describe("RBAC — combined Tables/Reservation column (PRD §2)", () => {
    const app = createApp();

    it("blocks Chef and Inventory Manager from the reservations list entirely", async () => {
      const { restaurantId } = await setup();
      const { user: chef } = await createTestStaff(restaurantId, "chef");
      const { user: inventoryManager } = await createTestStaff(restaurantId, "inventory_manager");

      const chefRes = await request(app)
        .get("/api/reservations")
        .set("Authorization", `Bearer ${tokenFor(chef)}`);
      const invRes = await request(app)
        .get("/api/reservations")
        .set("Authorization", `Bearer ${tokenFor(inventoryManager)}`);

      expect(chefRes.status).toBe(403);
      expect(invRes.status).toBe(403);
    });

    it("allows Cashier to view but blocks Cashier from creating a reservation", async () => {
      const { restaurantId } = await setup();
      const { user: cashier } = await createTestStaff(restaurantId, "cashier");
      const token = tokenFor(cashier);

      const viewRes = await request(app)
        .get("/api/reservations")
        .set("Authorization", `Bearer ${token}`);
      expect(viewRes.status).toBe(200);

      const createRes = await request(app)
        .post("/api/reservations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          guestName: "Cashier Attempt",
          guestPhone: "9999900018",
          partySize: 2,
          reservationTime: reservationTimeInput(),
        });
      expect(createRes.status).toBe(403);
    });

    it("allows Server to create a reservation", async () => {
      const { restaurantId, server } = await setup();
      const res = await request(app)
        .post("/api/reservations")
        .set("Authorization", `Bearer ${tokenFor(server)}`)
        .send({
          guestName: "Server Creates",
          guestPhone: "9999900019",
          partySize: 2,
          reservationTime: reservationTimeInput(),
        });
      expect(res.status).toBe(201);
    });

    it("allows Owner/Manager full access including delete", async () => {
      const { restaurantId } = await setup();
      const { user: owner } = await createTestStaff(restaurantId, "owner");
      const createRes = await request(app)
        .post("/api/reservations")
        .set("Authorization", `Bearer ${tokenFor(owner)}`)
        .send({
          guestName: "Owner Creates",
          guestPhone: "9999900020",
          partySize: 2,
          reservationTime: reservationTimeInput(),
        });
      expect(createRes.status).toBe(201);

      const reservationId = createRes.body.reservation.id as string;
      const deleteRes = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set("Authorization", `Bearer ${tokenFor(owner)}`);
      expect(deleteRes.status).toBe(200);
    });
  });
});
