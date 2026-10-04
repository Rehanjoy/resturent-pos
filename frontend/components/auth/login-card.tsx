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
    <div className="glass-elevated w-full max-w-md rounded-[2rem] p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white bg-gradient-to-br from-white to-primary/10 shadow-[0_12px_28px_rgba(86,43,25,0.12)]">
          <Image src="/logo-mark.svg" alt="" width={42} height={42} />
        </span>
        <p className="mt-4 font-heading text-2xl font-semibold tracking-tight text-text">Welcome to Saffron</p>
        <p className="mt-1 text-center text-small text-text-muted">Secure access to your restaurant workspace</p>
      </div>

      {step.kind === "credentials" ? (
        <>
          <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/80 bg-white/50 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setMethod("password")}
              className={`flex-1 py-2 text-small font-medium ${method === "password" ? "bg-background text-text" : "text-text-muted"
                }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => setMethod("pin")}
              className={`flex-1 py-2 text-small font-medium ${method === "pin" ? "bg-background text-text" : "text-text-muted"
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
