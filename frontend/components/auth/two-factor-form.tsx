"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth/api";
import type { AuthUser } from "@/lib/auth/types";

interface Props {
  twoFactorToken: string;
  onAuthenticated: (accessToken: string, user: AuthUser) => void;
  onBack: () => void;
}

/**
 * Mandatory 2FA step shown after a correct password for Owner/Admin/
 * Manager accounts (PRD §3.1; noted but not separately wireframed in
 * docs/03-wireframes/login.html's State A annotation).
 */
export function TwoFactorForm({ twoFactorToken, onAuthenticated, onBack }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.verifyTwoFactor(twoFactorToken, code);
      onAuthenticated(result.accessToken, result.user);
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
        Enter the 6-digit code from your authenticator app.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small text-error"
        >
          {error}
        </p>
      )}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        className="rounded-md border border-border bg-background px-3 py-2 text-center text-body tracking-[0.4em] text-text focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={isSubmitting || code.length !== 6}
        className="rounded-md bg-accent py-2 text-button text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Verifying…" : "Verify & Log In"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-small text-secondary underline"
      >
        Back to login
      </button>
    </form>
  );
}
