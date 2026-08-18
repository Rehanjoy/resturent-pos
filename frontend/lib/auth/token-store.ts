/**
 * In-memory-only access token store — deliberately NOT localStorage or
 * sessionStorage. Per PRD §7 (XSS mitigation), a plain module-level
 * variable can't be read by browser storage inspection and isn't exposed
 * to any script that doesn't already have access to this module's scope.
 * The refresh token (7-day) never touches JavaScript at all — it's an
 * httpOnly cookie the browser manages entirely; the backend is the only
 * thing that ever reads it.
 *
 * Trade-off: this variable resets to `null` on every full page reload.
 * `AuthProvider` (`auth-context.tsx`) calls `POST /api/auth/refresh` on
 * mount to silently re-derive a fresh access token from the httpOnly
 * cookie before rendering any protected content.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
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
