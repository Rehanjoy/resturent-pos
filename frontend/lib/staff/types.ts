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

export type StaffModule =
  | "dashboard"
  | "customers"
  | "tables"
  | "reservations"
  | "orders"
  | "kitchen"
  | "menu"
  | "inventory"
  | "bills"
  | "reports"
  | "staff"
  | "website"
  | "marketing"
  | "settings";

export const STAFF_MODULE_OPTIONS: { value: StaffModule; label: string; description: string }[] = [
  { value: "dashboard", label: "Dashboard", description: "Live business summary" },
  { value: "customers", label: "Customers", description: "Guest visits and service notes" },
  { value: "tables", label: "Tables", description: "Floor, chairs and bookings" },
  { value: "reservations", label: "Reservations", description: "Upcoming guest reservations" },
  { value: "orders", label: "Orders", description: "Order list and progress" },
  { value: "kitchen", label: "Kitchen", description: "KDS tickets and preparation" },
  { value: "menu", label: "Menu", description: "Dishes and availability" },
  { value: "inventory", label: "Inventory", description: "Stock and recipes" },
  { value: "bills", label: "Bills", description: "Invoices and settlement" },
  { value: "reports", label: "Reports", description: "Sales and performance" },
  { value: "staff", label: "Staff", description: "Team access management" },
  { value: "website", label: "Website", description: "Public website content" },
  { value: "marketing", label: "Marketing", description: "Campaigns and inbox" },
  { value: "settings", label: "Settings", description: "Restaurant configuration" },
];

export const ROLE_DEFAULT_MODULES: Record<StaffRole, StaffModule[]> = {
  owner: STAFF_MODULE_OPTIONS.map((module) => module.value),
  manager: STAFF_MODULE_OPTIONS.map((module) => module.value),
  cashier: ["dashboard", "customers", "tables", "reservations", "orders", "kitchen", "menu", "bills", "reports"],
  server: ["customers", "tables", "reservations", "orders", "kitchen", "menu"],
  chef: ["orders", "kitchen", "menu", "inventory"],
  inventory_manager: ["menu", "inventory"],
};

export function defaultModulesForRole(role: StaffRole): StaffModule[] {
  return [...ROLE_DEFAULT_MODULES[role]];
}

/** Mirrors `backend/src/services/staff.service.ts` `StaffDto`. */
export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  visibleModules: StaffModule[];
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
