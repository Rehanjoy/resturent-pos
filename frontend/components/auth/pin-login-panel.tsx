"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { authApi, type PinPickerStaff } from "@/lib/auth/api";
import type { AuthUser } from "@/lib/auth/types";

interface Props {
  onAuthenticated: (accessToken: string, user: AuthUser) => void;
}

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "enter"];

/**
 * State B of docs/03-wireframes/login.html — PIN quick login for shared
 * POS terminal clock-in. The staff list comes from
 * `GET /api/auth/pin-login/staff`, a minimal read-only endpoint scoped to
 * this auth flow (the full Staff management module is a later build
 * part) — see the auth module's build notes for the restaurantId
 * resolution rule for self-hosted (single-restaurant) deployments.
 */
export function PinLoginPanel({ onAuthenticated }: Props) {
  const [staff, setStaff] = useState<PinPickerStaff[] | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .pinLoginStaff()
      .then((result) => {
        if (cancelled) return;
        setStaff(result.staff);
        setRestaurantId(result.restaurantId);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Could not load staff — check your connection and try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitPin(candidatePin: string, staffId: string) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await authApi.pinLogin(staffId, candidatePin, restaurantId ?? undefined);
      onAuthenticated(result.accessToken, result.user);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server — check your connection and try again.",
      );
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyPress(key: string) {
    if (isSubmitting || !selectedStaffId) return;
    if (key === "back") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (key === "enter") {
      if (pin.length >= MIN_PIN_LENGTH) void submitPin(pin, selectedStaffId);
      return;
    }
    setPin((current) => (current.length < MAX_PIN_LENGTH ? current + key : current));
  }

  if (loadError) {
    return <p className="text-small text-error">{loadError}</p>;
  }

  if (!staff) {
    return <p className="text-small text-text-muted">Loading staff…</p>;
  }

  if (staff.length === 0) {
    return (
      <p className="text-small text-text-muted">
        No staff accounts yet. Log in with your admin email and password to get started.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-small text-text-muted">Select your name:</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {staff.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => {
              setSelectedStaffId(member.id);
              setPin("");
              setSubmitError(null);
            }}
            className={`rounded-md border p-2 text-center text-small ${
              selectedStaffId === member.id
                ? "border-primary bg-background text-text"
                : "border-border bg-surface text-text-muted"
            }`}
          >
            <span className="mx-auto mb-1 block h-8 w-8 rounded-full bg-border" aria-hidden />
            {member.name}
          </button>
        ))}
      </div>

      {submitError && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small text-error"
        >
          {submitError}
        </p>
      )}

      <p className="mb-2 text-center text-small text-text-muted">Enter PIN</p>
      <div className="mb-4 flex justify-center gap-2">
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border border-border ${
              index < pin.length ? "bg-text" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!selectedStaffId || isSubmitting}
            onClick={() => handleKeyPress(key)}
            className="rounded-md border border-border bg-background py-3 text-body text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {key === "back" ? "⌫" : key === "enter" ? "↵" : key}
          </button>
        ))}
      </div>
    </div>
  );
}
