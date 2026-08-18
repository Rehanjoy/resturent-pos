"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Shared chrome for every /admin route (POS + Dashboard). Gates access to
 * an authenticated session and shows the minimal staff-identity indicator
 * every wireframe puts in the top bar (name, role, log out). The full nav
 * rail / top bar from docs/03-wireframes get built out here in later
 * parts — this covers the auth-module slice of the shell.
 *
 * This is a client-side guard rather than `middleware.ts`: the access
 * token lives in memory only (see `lib/auth/token-store.ts`) and the
 * refresh cookie is httpOnly + opaque to the frontend, so Next.js
 * middleware (which runs before any client JS and can't call our React
 * context) can't verify auth state without re-implementing the refresh
 * flow at the edge or exposing the JWT secret there — a worse trade-off
 * than the brief loading flash this approach has while the initial
 * `/api/auth/refresh` call (made by `AuthProvider`) resolves.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { status, user, clearSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user?.mustResetPassword) {
      router.replace("/reset-password");
    }
  }, [status, user, router]);

  const isGateOpen = status === "authenticated" && user && !user.mustResetPassword;

  if (!isGateOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-small text-text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <span className="font-heading text-lg font-semibold text-text">Saffron</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-small font-medium text-text">{user.name}</p>
            <p className="text-small capitalize text-text-muted">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void clearSession().then(() => router.push("/login"));
            }}
            className="rounded-md border border-border px-3 py-1.5 text-small text-text-muted hover:text-text"
          >
            Log out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
