"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/**
 * Shared chrome for every /admin route (POS + Dashboard): a dark, full-height
 * nav rail (`Sidebar`) and a top bar (`Topbar`). Gates access to an
 * authenticated session; nav role-filtering and the staff-identity/log-out
 * affordance now live in `Sidebar` (see that file's doc comment) — this is
 * a UX convenience only, every route still re-checks role server-side and
 * each screen also gates itself.
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
    <div className="flex min-h-screen bg-background">
      <Sidebar
        role={user.role}
        user={user}
        onLogout={() => {
          void clearSession().then(() => router.push("/login"));
        }}
      />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <Topbar user={user} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
