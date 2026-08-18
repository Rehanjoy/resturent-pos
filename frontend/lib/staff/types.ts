export type StaffRole = "owner" | "manager" | "cashier" | "server" | "chef" | "inventory_manager";

/** Mirrors `MANAGER_ASSIGNABLE_ROLES` in `backend/src/services/staff.service.ts`
 * — the server re-checks this on every request; this copy only drives which
 * options/actions the UI offers a Manager up front. */
export const MANAGER_ASSIGNABLE_ROLES: StaffRole[] = ["cashier", "server", "chef", "inventory_manager"];

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "server", label: "Server / Waiter" },
  { value: "chef", label: "Chef / Kitchen Staff" },
  { value: "inventory_manager", label: "Inventory Manager" },
];

/** Mirrors `backend/src/services/staff.service.ts` `StaffDto`. */
export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  isActive: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `backend/src/services/staff.service.ts` `StaffActivityLogEntryDto`. */
export interface StaffActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  createdAt: string;
}

/** Mirrors `backend/src/services/staff.service.ts` `StaffSessionDto`. */
export interface StaffSession {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isActive: boolean;
}
