/** Mirrors `backend/src/services/area.service.ts` `AreaDto`. */
export interface Area {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type TableShape = "round" | "square";
export type TableStatus = "free" | "occupied" | "reserved" | "needs_cleaning";

/** Mirrors `backend/src/services/table.service.ts` `TableDto`. */
export interface RestaurantTable {
  id: string;
  restaurantId: string;
  areaId: string;
  name: string;
  seatingCapacity: number;
  shape: TableShape;
  status: TableStatus;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

/** Socket.io event payload contract for `table:status-changed`. */
export interface TableStatusChangedEvent {
  table: RestaurantTable;
}
