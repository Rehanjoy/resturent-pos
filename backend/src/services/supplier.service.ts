import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Supplier, type SupplierDocument } from "../models/supplier.model";

export interface SupplierDto {
  id: string;
  restaurantId: string;
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(supplier: HydratedDocument<SupplierDocument>): SupplierDto {
  return {
    id: supplier._id.toString(),
    restaurantId: supplier.restaurantId.toString(),
    name: supplier.name,
    contactPhone: supplier.contactPhone,
    contactEmail: supplier.contactEmail,
    notes: supplier.notes,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export async function listSuppliers(restaurantId: string): Promise<SupplierDto[]> {
  const suppliers = await Supplier.find({ restaurantId }).sort({ name: 1 });
  return suppliers.map(toDto);
}

export interface SupplierInput {
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

export async function createSupplier(
  restaurantId: string,
  input: SupplierInput,
): Promise<SupplierDto> {
  const supplier = await Supplier.create({
    restaurantId,
    name: input.name,
    contactPhone: input.contactPhone || undefined,
    contactEmail: input.contactEmail || undefined,
    notes: input.notes || undefined,
  });
  return toDto(supplier);
}

async function findSupplierOrThrow(
  restaurantId: string,
  supplierId: string,
): Promise<HydratedDocument<SupplierDocument>> {
  if (!Types.ObjectId.isValid(supplierId)) {
    throw new AppError("Supplier not found.", 404, "NOT_FOUND");
  }
  const supplier = await Supplier.findOne({ _id: supplierId, restaurantId });
  if (!supplier) {
    throw new AppError("Supplier not found.", 404, "NOT_FOUND");
  }
  return supplier;
}

export async function updateSupplier(
  restaurantId: string,
  supplierId: string,
  input: Partial<SupplierInput>,
): Promise<SupplierDto> {
  const supplier = await findSupplierOrThrow(restaurantId, supplierId);

  if (input.name !== undefined) supplier.name = input.name;
  if (input.contactPhone !== undefined) supplier.contactPhone = input.contactPhone || undefined;
  if (input.contactEmail !== undefined) supplier.contactEmail = input.contactEmail || undefined;
  if (input.notes !== undefined) supplier.notes = input.notes || undefined;

  await supplier.save();
  return toDto(supplier);
}
