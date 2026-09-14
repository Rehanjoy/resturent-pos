import type { SpiceLevel } from "@/lib/menu/types";

export type OrderStatus =
  | "draft"
  | "sent"
  | "in_kitchen"
  | "ready"
  | "served"
  | "billed"
  | "closed"
  | "void";

export type OrderItemStatus = "pending" | "sent" | "ready" | "served";

/** Mirrors `backend/src/services/order.service.ts` `OrderItemDto`. */
export interface OrderItem {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  /** Integer paise — see `lib/format.ts`. */
  priceSnapshot: number;
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  sentAt?: string;
  estimatedReadyAt?: string;
}

/** Mirrors `backend/src/services/order.service.ts` `OrderDto`. */
export interface Order {
  id: string;
  restaurantId: string;
  tableId: string;
  status: OrderStatus;
  source?: "staff" | "qr";
  diningSessionId?: string;
  placedAt?: string;
  customerTotal?: number;
  cancellation?: { chargePercent: number; amountDue: number; cancelledAt: string; reason: string };
  items: OrderItem[];
  /** Sum of `priceSnapshot * qty`, paise. Tax/discount/total belong to the
   * Billing module (not built yet). */
  subtotal: number;
  createdByStaffId: string;
  servedByStaffId?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `backend/src/services/order.service.ts` `KotItemDto`. */
export interface KotItem {
  orderItemId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  estimatedReadyAt?: string;
}

/** Mirrors `backend/src/services/order.service.ts` `KotDto`. */
export interface Kot {
  id: string;
  restaurantId: string;
  orderId: string;
  tableId: string;
  items: KotItem[];
  sentAt: string;
  allReadyAt?: string;
  servedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Socket.io event payload contracts (PRD §6.13). */
export interface OrderCreatedEvent {
  order: Order;
}
export interface OrderUpdatedEvent {
  order: Order;
}
export interface KitchenNewTicketEvent {
  kot: Kot;
}
export interface KitchenTicketReadyEvent {
  kot: Kot;
}
