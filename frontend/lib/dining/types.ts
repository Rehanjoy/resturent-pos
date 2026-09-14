export interface DiningSeat { tableId: string; chairNumber: number }
export interface DiningCustomer { name: string; phone: string }
export interface DiningPolicy { holdMinutes: number; freeCancellationMinutes: number; partialCancellationMinutes: number; partialChargePercent: number; defaultPrepMinutes: number }
export interface DiningMenuItem { id: string; name: string; description?: string; price: number; type: string; imageUrl?: string; categoryId: string; categoryName: string; prepMinutes: number }
export interface DiningTable { id: string; name: string; areaId: string; areaName: string; seatingCapacity: number; shape: string; status: string; chairs: { number: number; status: "available" | "held" | "occupied" | "unavailable" }[] }
export interface DiningContext { restaurant: { id: string; name: string; slug: string }; scanned: { tableId: string; tableName: string; chairNumber: number | null }; policy: DiningPolicy; tables: DiningTable[]; menu: DiningMenuItem[]; serverNow: string }
export interface DiningSession { id: string; source: string; status: "held" | "occupied" | "expired" | "released"; partySize: number; seats: DiningSeat[]; expiresAt: string | null; orderId?: string; policy: DiningPolicy; customer?: DiningCustomer; createdAt: string; releasedAt?: string }
export interface DiningOrder { id: string; status: string; subtotal: number; customerTotal?: number; placedAt?: string; cancellation?: { chargePercent: number; amountDue: number; cancelledAt: string; reason: string }; items: { id: string; nameSnapshot: string; priceSnapshot: number; qty: number; notes?: string; itemStatus: string; estimatedReadyAt?: string; sentAt?: string }[] }
export interface CancellationQuote { chargePercent: number; amountDue: number; freeUntil: string; partialUntil: string; canCancel: boolean }
export interface DiningSessionResponse { session: DiningSession; order: DiningOrder | null; cancellation: CancellationQuote | null; serverNow: string }
export interface CartItem { key: string; menuItemId: string; name: string; price: number; qty: number; notes?: string }
export type ServiceRequestType = "water" | "bill" | "help";
export interface ServiceRequest { id: string; sessionId: string; type: ServiceRequestType; note: string; status: "pending" | "acknowledged" | "completed" | "expired"; seats: (DiningSeat & { tableName: string })[]; createdAt: string; acknowledgedAt: string | null; completedAt: string | null }
