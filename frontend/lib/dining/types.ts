export interface DiningSeat { tableId: string; chairNumber: number }
export interface DiningCustomer { name: string; phone: string }
export interface DiningTaxConfig { name: string; ratePercent: number }
export interface DiningBillLine { name: string; ratePercent?: number; amount: number }
export interface DiningPolicy { holdMinutes: number; freeCancellationMinutes: number; partialCancellationMinutes: number; partialChargePercent: number; defaultPrepMinutes: number }
export interface DiningMenuItem { id: string; name: string; description?: string; price: number; type: string; imageUrl?: string; categoryId: string; categoryName: string; prepMinutes: number }
export interface DiningTable { id: string; name: string; areaId: string; areaName: string; seatingCapacity: number; shape: string; status: string; chairs: { number: number; status: "available" | "held" | "occupied" | "cleaning" | "unavailable" }[] }
export interface DiningContext { restaurant: { id: string; name: string; slug: string }; scanned: { tableId: string; tableName: string; chairNumber: number | null }; policy: DiningPolicy; taxConfig?: DiningTaxConfig[]; tables: DiningTable[]; menu: DiningMenuItem[]; serverNow: string }
export interface DiningSession { id: string; source: string; status: "held" | "occupied" | "cleaning" | "expired" | "released"; bookingMode?: "whole_table" | "chairs"; assignedWaiter?: { id: string; name: string } | null; partySize: number; seats: DiningSeat[]; expiresAt: string | null; orderId?: string; policy: DiningPolicy; customer?: DiningCustomer; createdAt: string; releasedAt?: string }
export interface DiningOrderItem { id: string; nameSnapshot: string; priceSnapshot: number; qty: number; notes?: string; itemStatus: string; estimatedReadyAt?: string; sentAt?: string; cancelledQty?: number }
export interface DiningCancellationRecord { id?: string; reason: string; cancelledAt: string; selectedSubtotal: number; baseCharge: number; taxLines: DiningBillLine[]; amountDue: number; lines: { orderItemId: string; nameSnapshot: string; qty: number; unitPrice: number; subtotal: number; chargePercent: number; baseCharge: number; taxLines: DiningBillLine[]; amountDue: number }[] }
export interface DiningBill { itemsSubtotal: number; activeItemsSubtotal: number; cancelledItemsSubtotal: number; cancellationBaseCharge: number; taxableSubtotal: number; taxLines: DiningBillLine[]; cancellationTaxLines: DiningBillLine[]; cancellationCharge: number; totalDue: number; paymentDue: number; explanation: string }
export interface DiningCancellationOption { orderItemId: string; availableQty: number; chargePercent?: number; amountDue?: number; freeUntil?: string; partialUntil?: string }
export interface DiningOrder {
  id: string;
  status: string;
  subtotal: number;
  discount?: { label?: string; amount: number };
  taxLines?: DiningBillLine[];
  taxTotal?: number;
  cancellationCharge?: number;
  amountDue?: number;
  customerTotal?: number;
  placedAt?: string;
  cancellation?: { chargePercent: number; amountDue: number; cancelledAt: string; reason: string };
  cancellations?: DiningCancellationRecord[];
  items: DiningOrderItem[];
}
export interface CancellationSelection { itemId: string; qty: number }
export interface CancellationQuoteLine { orderItemId: string; nameSnapshot: string; qty: number; unitPrice: number; subtotal: number; chargePercent: number; baseCharge: number; taxLines: DiningBillLine[]; amountDue: number; freeUntil: string; partialUntil: string }
export interface SelectedCancellationQuote { lines: CancellationQuoteLine[]; totals: { selectedSubtotal: number; baseCharge: number; taxLines: DiningBillLine[]; amountDue: number }; serverNow: string }
export interface CancellationQuote { chargePercent: number | null; amountDue: number; freeUntil: string; partialUntil: string; canCancel: boolean }
export interface DiningSessionResponse { session: DiningSession; order: DiningOrder | null; cancellation: CancellationQuote | null; cancellationOptions?: DiningCancellationOption[]; bill?: DiningBill | null; canAddItems?: boolean; serverNow: string }
export interface CartItem { key: string; menuItemId: string; name: string; price: number; qty: number; notes?: string }
export type ServiceRequestType = "water" | "bill" | "help";
export interface ServiceRequest { id: string; sessionId: string; type: ServiceRequestType; note: string; status: "pending" | "acknowledged" | "completed" | "expired"; seats: (DiningSeat & { tableName: string })[]; createdAt: string; acknowledgedAt: string | null; completedAt: string | null }
export interface DiningNotification {
  id: string;
  category: string;
  eventType: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string | null;
}
export interface DiningNotificationPage {
  notifications: DiningNotification[];
  nextCursor: string | null;
  unreadCount: number;
}
