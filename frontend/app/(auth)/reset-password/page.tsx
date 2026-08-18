"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { ForcePasswordResetForm } from "@/components/auth/force-password-reset-form";

/**
 * Gate for the forced-reset flow (PRD §3.1) — requires an authenticated
 * session (login already succeeded despite `mustResetPassword`). Redirects
 * away if there's no session, or forward to /admin once the flag clears,
 * so this can't be bypassed by navigating here directly.
 */
export default function ResetPasswordPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user && !user.mustResetPassword) {
      router.replace("/admin");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user?.mustResetPassword) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-small text-text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <Image src="/logo-mark.svg" alt="" width={48} height={48} />
          <p className="mt-2 font-heading text-xl font-semibold text-text">
            Set New Password
          </p>
        </div>
        <ForcePasswordResetForm />
      </div>
    </main>
  );
}
