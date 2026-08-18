"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "./api";
import { onSessionExpired, setAccessToken } from "./token-store";
import type { AuthUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Called after login/pin-login/2FA-verify succeed — stores the token and user. */
  setSession: (accessToken: string, user: AuthUser) => void;
  /** Revokes the session server-side (best-effort) and clears local state. */
  clearSession: () => Promise<void>;
  /** Re-pulls the current user (e.g. after a forced password reset completes). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the client-side auth state for the whole app (mounted once in
 * `app/providers.tsx`, above both `/login` and `/admin`). On mount it
 * silently calls `/api/auth/refresh` — the httpOnly refresh cookie is the
 * only thing that survives a hard page reload, since the access token is
 * held in memory only (see `token-store.ts`).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const setSession = useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: clear local state even if the network call fails —
      // the user still expects to be signed out on this device.
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await authApi.me();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => onSessionExpired(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then((result) => {
        if (cancelled) return;
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, setSession, clearSession, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
