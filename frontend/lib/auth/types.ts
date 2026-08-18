/**
 * Mirrors the sanitized user shape the backend returns from
 * login/refresh/pin-login/me (`backend/src/services/auth.service.ts`
 * `sanitizeUser`). Never includes passwordHash/pinHash/twoFactorSecret —
 * the backend never sends those fields back.
 */
export interface AuthUser {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier" | "server" | "chef" | "inventory_manager";
  isActive: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}
