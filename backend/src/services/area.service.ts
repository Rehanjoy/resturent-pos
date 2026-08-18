import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Area, type AreaDocument } from "../models/area.model";
import { Table } from "../models/table.model";

export interface AreaDto {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(area: HydratedDocument<AreaDocument>): AreaDto {
  return {
    id: area._id.toString(),
    restaurantId: area.restaurantId.toString(),
    name: area.name,
    displayOrder: area.displayOrder,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  };
}

async function assertUniqueName(
  restaurantId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await Area.findOne({
    restaurantId,
    name,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new AppError(
      `An area named "${name}" already exists.`,
      409,
      "DUPLICATE_AREA_NAME",
    );
  }
}

export async function listAreas(restaurantId: string): Promise<AreaDto[]> {
  const areas = await Area.find({ restaurantId }).sort({ displayOrder: 1, name: 1 });
  return areas.map(toDto);
}

export async function createArea(
  restaurantId: string,
  input: { name: string; displayOrder?: number },
): Promise<AreaDto> {
  await assertUniqueName(restaurantId, input.name);
  const area = await Area.create({
    restaurantId,
    name: input.name,
    displayOrder: input.displayOrder ?? 0,
  });
  return toDto(area);
}

async function findAreaOrThrow(
  restaurantId: string,
  areaId: string,
): Promise<HydratedDocument<AreaDocument>> {
  if (!Types.ObjectId.isValid(areaId)) {
    throw new AppError("Area not found.", 404, "NOT_FOUND");
  }
  const area = await Area.findOne({ _id: areaId, restaurantId });
  if (!area) {
    throw new AppError("Area not found.", 404, "NOT_FOUND");
  }
  return area;
}

export async function updateArea(
  restaurantId: string,
  areaId: string,
  input: { name?: string; displayOrder?: number },
): Promise<AreaDto> {
  const area = await findAreaOrThrow(restaurantId, areaId);

  if (input.name && input.name !== area.name) {
    await assertUniqueName(restaurantId, input.name, areaId);
    area.name = input.name;
  }
  if (input.displayOrder !== undefined) {
    area.displayOrder = input.displayOrder;
  }

  await area.save();
  return toDto(area);
}

export async function deleteArea(
  restaurantId: string,
  areaId: string,
): Promise<void> {
  const area = await findAreaOrThrow(restaurantId, areaId);

  const tableCount = await Table.countDocuments({ restaurantId, areaId: area._id });
  if (tableCount > 0) {
    throw new AppError(
      "This area still has tables assigned to it. Move or delete those tables first.",
      409,
      "AREA_HAS_TABLES",
    );
  }

  await area.deleteOne();
}
