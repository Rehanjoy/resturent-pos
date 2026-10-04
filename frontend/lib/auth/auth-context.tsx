"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "./api";
import {
  getAccessToken,
  onSessionExpired,
  setAccessToken,
  setStoredUser,
} from "./token-store";
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
 * Owns client-side auth state with 1-day session persistence.
 * Initializes synchronously from storage when an unexpired token exists,
 * preventing false unauthenticated bounces on page reloads or tab switches.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Server and browser must produce the same first render. Storage is read
  // inside the effect below, which prevents production hydration error #418.
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const setSession = useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    setStoredUser(nextUser);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: clear local state even if the network call fails
    } finally {
      setAccessToken(null);
      setStoredUser(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await authApi.me();
    setStoredUser(currentUser);
    setUser(currentUser);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setAccessToken(null);
      setStoredUser(null);
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => onSessionExpired(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const token = getAccessToken();
    const stored = getStoredUser<AuthUser>();
    if (stored) {
      setUser(stored);
      setStatus("authenticated");
    }
    if (token) {
      // Valid token is already present in storage (valid for 1 day).
      // Background verify current user state:
      authApi
        .me()
        .then((currentUser) => {
          if (cancelled) return;
          setStoredUser(currentUser);
          setUser(currentUser);
          setStatus("authenticated");
        })
        .catch(() => {
          if (cancelled) return;
          // me() failed: attempt silent refresh from cookie
          authApi
            .refresh()
            .then((result) => {
              if (cancelled) return;
              setAccessToken(result.accessToken);
              setStoredUser(result.user);
              setUser(result.user);
              setStatus("authenticated");
            })
            .catch(() => {
              if (cancelled) return;
              setAccessToken(null);
              setStoredUser(null);
              setUser(null);
              setStatus("unauthenticated");
            });
        });
    } else {
      // No token in storage: attempt silent refresh from cookie
      authApi
        .refresh()
        .then((result) => {
          if (cancelled) return;
          setAccessToken(result.accessToken);
          setStoredUser(result.user);
          setUser(result.user);
          setStatus("authenticated");
        })
        .catch(() => {
          if (cancelled) return;
          setAccessToken(null);
          setStoredUser(null);
          setUser(null);
          setStatus("unauthenticated");
        });
    }

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
