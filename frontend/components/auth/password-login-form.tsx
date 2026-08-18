"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth/api";
import type { AuthUser } from "@/lib/auth/types";

interface Props {
  onAuthenticated: (accessToken: string, user: AuthUser) => void;
  onTwoFactorRequired: (twoFactorToken: string) => void;
}

/** State A of docs/03-wireframes/login.html — email + password. */
export function PasswordLoginForm({ onAuthenticated, onTwoFactorRequired }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.login(email, password);
      if (result.twoFactorRequired) {
        onTwoFactorRequired(result.twoFactorToken);
        return;
      }
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
      {error && (
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small text-error"
        >
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-small text-text-muted">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="owner@restaurant.com"
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-text focus:border-primary focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-small text-text-muted">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-text focus:border-primary focus:outline-none"
        />
      </label>
      <p className="-mt-2 text-right text-small text-text-muted">
        Forgot password? <span className="underline">Contact your admin.</span>
      </p>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-accent py-2 text-button text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Logging in…" : "Log In"}
      </button>
    </form>
  );
}
