const ACCESS_TOKEN_KEY = "saffron_access_token";
const AUTH_USER_KEY = "saffron_auth_user";

let inMemoryToken: string | null = null;

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    // Cushion of 10 seconds before actual exp
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 10000;
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  if (inMemoryToken && isTokenValid(inMemoryToken)) {
    return inMemoryToken;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (stored) {
        if (isTokenValid(stored)) {
          inMemoryToken = stored;
          return stored;
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          inMemoryToken = null;
        }
      }
    } catch {
      // Ignore localStorage exceptions (private mode, SSR)
    }
  }

  return null;
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

export function getStoredUser<T>(): T | null {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredUser(user: unknown | null): void {
  if (typeof window !== "undefined") {
    try {
      if (user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

// Lets the transport layer (lib/api.ts) tell AuthProvider "the session is
// no longer valid" (e.g. a silent refresh failed) without api.ts having to
// import React/context directly.
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function onSessionExpired(listener: SessionExpiredListener | null): void {
  sessionExpiredListener = listener;
}

export function notifySessionExpired(): void {
  sessionExpiredListener?.();
}

