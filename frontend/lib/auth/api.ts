import { api } from "@/lib/api";
import type { AuthUser } from "./types";

interface LoginPasswordSuccess {
  twoFactorRequired: false;
  accessToken: string;
  user: AuthUser;
}

interface LoginTwoFactorRequired {
  twoFactorRequired: true;
  twoFactorToken: string;
}

export type LoginResult = LoginPasswordSuccess | LoginTwoFactorRequired;

export interface SessionResult {
  accessToken: string;
  user: AuthUser;
}

export interface PinPickerStaff {
  id: string;
  name: string;
  role: AuthUser["role"];
}

export interface PinLoginStaffListResult {
  restaurantId: string;
  staff: PinPickerStaff[];
}

/**
 * Typed endpoint calls for the auth module, all going through the single
 * transport client in `lib/api.ts`. Kept separate from the generic
 * `api.get/post/...` helpers the same way `lib/hooks/use-health-check.ts`
 * wraps a typed call around the client.
 */
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResult>("/api/auth/login", { email, password }),

  verifyTwoFactor: (twoFactorToken: string, code: string) =>
    api.post<SessionResult>("/api/auth/2fa/verify", { twoFactorToken, code }),

  pinLoginStaff: (restaurantId?: string) =>
    api.get<PinLoginStaffListResult>(
      `/api/auth/pin-login/staff${
        restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ""
      }`,
    ),

  pinLogin: (staffId: string, pin: string, restaurantId?: string) =>
    api.post<SessionResult>("/api/auth/pin-login", {
      staffId,
      pin,
      restaurantId,
    }),

  refresh: () => api.post<SessionResult>("/api/auth/refresh"),

  logout: () => api.post<{ message: string }>("/api/auth/logout"),

  me: () => api.get<AuthUser>("/api/auth/me"),

  resetPassword: (newPassword: string) =>
    api.post<{ message: string }>("/api/auth/reset-password", { newPassword }),

  setupTwoFactor: () =>
    api.post<{ otpauthUrl: string; qrCodeDataUrl: string }>("/api/auth/2fa/setup"),

  enableTwoFactor: (code: string) =>
    api.post<{ message: string }>("/api/auth/2fa/enable", { code }),
};
