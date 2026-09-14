import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Area } from "../models/area.model";
import {
  Table,
  type TableDocument,
  type TableShape,
  type TableStatus,
} from "../models/table.model";
import { emitToRestaurant } from "../sockets";
import { changeFloor } from "./dining.service";
import { DiningFloor } from "../models/dining-floor.model";

async function assertNoDiningParty(restaurantId: string, tableId: string, block?: string, requireFree = false) {
  await changeFloor(restaurantId, floor => {
    if (floor.sessions.some(s => (s.status === "held" || s.status === "occupied") && s.seats.some(seat => seat.tableId === tableId))) {
      throw new AppError("This table has active dining parties. Release each party from Seating first.", 409, "CHAIR_SESSION_ACTIVE");
    }
    if (requireFree && floor.tableBlocks[tableId]) throw new AppError("This table was just taken.", 409, "TABLE_NOT_FREE");
    if (block) floor.tableBlocks[tableId] = block;
  });
}

export interface TableDto {
  id: string;
  restaurantId: string;
  areaId: string;
  name: string;
  seatingCapacity: number;
  shape: TableShape;
  status: TableStatus;
  qrToken: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Event contract: `table:status-changed` payload — see docs/env-registry.md-adjacent handover notes. */
export interface TableStatusChangedEvent {
  table: TableDto;
}

function toDto(table: HydratedDocument<TableDocument>): TableDto {
  return {
    id: table._id.toString(),
    restaurantId: table.restaurantId.toString(),
    areaId: table.areaId.toString(),
    name: table.name,
    seatingCapacity: table.seatingCapacity,
    shape: table.shape,
    status: table.status,
    qrToken: table.qrToken,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}

async function assertAreaExists(restaurantId: string, areaId: string): Promise<void> {
  if (!Types.ObjectId.isValid(areaId)) {
    throw new AppError("Selected area does not exist.", 400, "AREA_NOT_FOUND");
  }
  const area = await Area.findOne({ _id: areaId, restaurantId });
  if (!area) {
    throw new AppError("Selected area does not exist.", 400, "AREA_NOT_FOUND");
  }
}

async function findTableOrThrow(
  restaurantId: string,
  tableId: string,
): Promise<HydratedDocument<TableDocument>> {
  if (!Types.ObjectId.isValid(tableId)) {
    throw new AppError("Table not found.", 404, "NOT_FOUND");
  }
  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (!table) {
    throw new AppError("Table not found.", 404, "NOT_FOUND");
  }
  return table;
}

export async function listTables(
  restaurantId: string,
  filters: { areaId?: string },
): Promise<TableDto[]> {
  const tables = await Table.find({
    restaurantId,
    ...(filters.areaId ? { areaId: filters.areaId } : {}),
  }).sort({ name: 1 });
  const floor = await DiningFloor.findOne({ restaurantId }).lean();
  return tables.map(table => {
    const dto = toDto(table);
    const parties = floor?.sessions.filter(s => (s.status === "occupied" || (s.status === "held" && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()))) && s.seats.some(seat => seat.tableId === dto.id)) ?? [];
    if (parties.length) dto.status = parties.some(s => s.status === "occupied") ? "occupied" : "reserved";
    return dto;
  });
}

export async function createTable(
  restaurantId: string,
  input: {
    areaId: string;
    name: string;
    seatingCapacity: number;
    shape: TableShape;
  },
): Promise<TableDto> {
  await assertAreaExists(restaurantId, input.areaId);

  const table = await Table.create({
    restaurantId,
    areaId: input.areaId,
    name: input.name,
    seatingCapacity: input.seatingCapacity,
    shape: input.shape,
    status: "free",
  });
  return toDto(table);
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  input: {
    areaId?: string;
    name?: string;
    seatingCapacity?: number;
    shape?: TableShape;
  },
): Promise<TableDto> {
  const table = await findTableOrThrow(restaurantId, tableId);

  if (input.areaId) {
    await assertAreaExists(restaurantId, input.areaId);
    table.areaId = new Types.ObjectId(input.areaId);
  }
  if (input.name !== undefined) table.name = input.name;
  if (input.seatingCapacity !== undefined) {
    await assertNoDiningParty(restaurantId, tableId, "maintenance");
    table.seatingCapacity = input.seatingCapacity;
  }
  if (input.shape !== undefined) table.shape = input.shape;

  await table.save();
  if (input.seatingCapacity !== undefined) await changeFloor(restaurantId, floor => {
    if (table.status === "free") delete floor.tableBlocks[tableId];
    else floor.tableBlocks[tableId] = table.status;
  });
  return toDto(table);
}

export async function deleteTable(
  restaurantId: string,
  tableId: string,
): Promise<void> {
  const table = await findTableOrThrow(restaurantId, tableId);
  await assertNoDiningParty(restaurantId, tableId, "deleted");
  await table.deleteOne();
}

/**
 * The high-frequency status transition (free/occupied/reserved/needs
 * cleaning). Persists the change then emits `table:status-changed` to
 * every terminal in the restaurant's Socket.io room (PRD §3.5 "real-time
 * table-status sync") — payload shape is `{ table: TableDto }` so a
 * connected client can patch its local table list in place without a
 * refetch.
 */
export async function updateTableStatus(
  restaurantId: string,
  tableId: string,
  status: TableStatus,
  requireFree = false,
): Promise<TableDto> {
  const table = await findTableOrThrow(restaurantId, tableId);
  if (requireFree && table.status !== "free") throw new AppError("This table is not free.", 409, "TABLE_NOT_FREE");
  await assertNoDiningParty(restaurantId, tableId, status === "free" ? undefined : status, requireFree);
  table.status = status;
  await table.save();
  if (status === "free") await changeFloor(restaurantId, floor => { delete floor.tableBlocks[tableId]; });

  const dto = toDto(table);
  const event: TableStatusChangedEvent = { table: dto };
  emitToRestaurant(restaurantId, "table:status-changed", event);

  return dto;
}
