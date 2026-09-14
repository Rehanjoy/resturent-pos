export type ServiceTag = "normal" | "good" | "vip" | "needs_attention";
export interface CustomerSummary { id: string; name: string; phone: string; serviceTag: ServiceTag; serviceNotes: string; visitCount: number; amountPaid: number; lastVisitAt: string | null }
export interface CustomerVisit { id: string; name: string; partySize: number; seats: { tableId: string; chairNumber: number }[]; status: string; source: string; startedAt: string; endedAt: string | null; durationMinutes: number; orderId?: string; amountPaid: number; paidAt: string | null }
export interface CustomerDetail { customer: Pick<CustomerSummary, "id" | "name" | "phone" | "serviceTag" | "serviceNotes">; visits: CustomerVisit[]; serverNow: string }
