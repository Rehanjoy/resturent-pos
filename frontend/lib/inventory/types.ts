/** Mirrors `backend/src/services/inventory-category.service.ts` `InventoryCategoryDto`. */
export interface InventoryCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `backend/src/services/supplier.service.ts` `SupplierDto`. */
export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `backend/src/services/inventory-item.service.ts` `InventoryItemDto`. */
export interface InventoryItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  unit: string;
  /** Integer paise — see `lib/format.ts`. */
  costPerUnit: number;
  /** Can be fractional (e.g. 4.5 kg) and can go negative — see
   * `backend/src/services/inventory-deduction.service.ts` for why. */
  currentStock: number;
  reorderThreshold: number;
  supplierId?: string;
  reorderRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransactionType = "deduction" | "restock" | "adjustment";

/** Mirrors `backend/src/services/inventory-transaction.service.ts` `InventoryTransactionDto`. */
export interface InventoryTransaction {
  id: string;
  restaurantId: string;
  itemId: string;
  type: InventoryTransactionType;
  quantityDelta: number;
  reason?: string;
  staffId: string;
  relatedOrderId?: string;
  createdAt: string;
}
