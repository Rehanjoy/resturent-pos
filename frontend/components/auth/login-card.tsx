"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";
import { PasswordLoginForm } from "./password-login-form";
import { PinLoginPanel } from "./pin-login-panel";
import { TwoFactorForm } from "./two-factor-form";

type LoginMethod = "password" | "pin";
type LoginStep = { kind: "credentials" } | { kind: "twoFactor"; twoFactorToken: string };

/**
 * docs/03-wireframes/login.html — one card, "Login Method" toggle switches
 * between State A (email + password, with a 2FA step when required) and
 * State B (PIN quick login for terminal clock-in).
 */
export function LoginCard() {
  const [method, setMethod] = useState<LoginMethod>("password");
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });
  const { status, setSession } = useAuth();
  const router = useRouter();

  // Already signed in (e.g. navigated back to /login manually) — bounce
  // straight to the app instead of showing the form again.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/admin");
    }
  }, [status, router]);

  function handleAuthenticated(accessToken: string, user: AuthUser) {
    setSession(accessToken, user);
    router.push(user.mustResetPassword ? "/reset-password" : "/admin");
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <Image src="/logo-mark.svg" alt="" width={48} height={48} />
        <p className="mt-2 font-heading text-xl font-semibold text-text">Saffron</p>
        <p className="text-small text-text-muted">Restaurant POS &amp; Management</p>
      </div>

      {step.kind === "credentials" ? (
        <>
          <div className="mb-6 flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setMethod("password")}
              className={`flex-1 py-2 text-small font-medium ${
                method === "password" ? "bg-background text-text" : "text-text-muted"
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => setMethod("pin")}
              className={`flex-1 py-2 text-small font-medium ${
                method === "pin" ? "bg-background text-text" : "text-text-muted"
              }`}
            >
              PIN Quick Login
            </button>
          </div>

          {method === "password" ? (
            <PasswordLoginForm
              onAuthenticated={handleAuthenticated}
              onTwoFactorRequired={(twoFactorToken) =>
                setStep({ kind: "twoFactor", twoFactorToken })
              }
            />
          ) : (
            <PinLoginPanel onAuthenticated={handleAuthenticated} />
          )}
        </>
      ) : (
        <TwoFactorForm
          twoFactorToken={step.twoFactorToken}
          onAuthenticated={handleAuthenticated}
          onBack={() => setStep({ kind: "credentials" })}
        />
      )}
    </div>
  );
}
