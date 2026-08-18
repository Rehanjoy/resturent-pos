"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Forced reset interstitial for admin-created accounts on first login
 * (PRD §3.1). Login already succeeded and issued a real session by the
 * time this form is shown — this just clears `mustResetPassword` before
 * letting the user into the app.
 */
export function ForcePasswordResetForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refreshUser } = useAuth();
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword(newPassword);
      await refreshUser();
      router.push("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-small text-text-muted">
        This account needs a new password before continuing.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small text-error"
        >
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-small text-text-muted">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-text focus:border-primary focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-small text-text-muted">
        Confirm new password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-text focus:border-primary focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-accent py-2 text-button text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : "Set New Password"}
      </button>
    </form>
  );
}
