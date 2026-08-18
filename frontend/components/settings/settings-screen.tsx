"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { settingsApi } from "@/lib/settings/api";
import type {
  DiscountApprovalThreshold,
  PaymentMode,
  RestaurantAddress,
  TaxConfigEntry,
} from "@/lib/settings/types";
import { ProfileForm } from "./profile-form";
import { TaxConfigForm } from "./tax-config-form";
import { DiscountPolicyForm } from "./discount-policy-form";
import { PaymentModesForm } from "./payment-modes-form";

const VIEW_ROLES = new Set(["owner", "manager"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Settings (PRD §3.14). Scope for this build: Restaurant profile, Tax
 * configuration, Discount policy, Payment mode toggles. Printer
 * configuration (ESC-POS/network — needs real hardware to integrate
 * against) and notification preferences (WhatsApp/SMS/Email — no provider
 * wired up, Phase 2 per the brief) are deliberately not built here yet,
 * consistent with how the Menu module deferred S3 image upload and the
 * Billing module deferred ESC-POS printing.
 */
export function SettingsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<Record<string, string | null>>({});

  const canView = !!user && VIEW_ROLES.has(user.role);
  const canEditProfile = !!user && user.role === "owner";

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get().then((result) => result.settings),
    enabled: canView,
  });

  function onSuccessFor(section: string) {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setError((current) => ({ ...current, [section]: null }));
      setNotice((current) => ({ ...current, [section]: "Saved." }));
      setTimeout(() => setNotice((current) => ({ ...current, [section]: null })), 2500);
    };
  }

  function onErrorFor(section: string, fallback: string) {
    return (err: unknown) =>
      setError((current) => ({ ...current, [section]: errorMessageOf(err, fallback) }));
  }

  const profileMutation = useMutation({
    mutationFn: (input: { name: string; address: RestaurantAddress; gstNumber: string; logoUrl: string }) =>
      settingsApi.updateProfile(input),
    onSuccess: onSuccessFor("profile"),
    onError: onErrorFor("profile", "Could not update the restaurant profile."),
  });

  const taxConfigMutation = useMutation({
    mutationFn: (taxConfig: TaxConfigEntry[]) => settingsApi.updateTaxConfig(taxConfig),
    onSuccess: onSuccessFor("taxConfig"),
    onError: onErrorFor("taxConfig", "Could not update tax configuration."),
  });

  const discountMutation = useMutation({
    mutationFn: (threshold: DiscountApprovalThreshold) => settingsApi.updateDiscountThreshold(threshold),
    onSuccess: onSuccessFor("discount"),
    onError: onErrorFor("discount", "Could not update the discount policy."),
  });

  const paymentModesMutation = useMutation({
    mutationFn: (modes: PaymentMode[]) => settingsApi.updatePaymentModes(modes),
    onSuccess: onSuccessFor("paymentModes"),
    onError: onErrorFor("paymentModes", "Could not update payment modes."),
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You don&apos;t have access to Settings.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-h1 font-semibold text-text">Settings</h1>
        <p className="text-small text-text-muted">
          Restaurant profile, tax configuration, discount policy, and payment modes.
        </p>
      </div>

      {settingsQuery.isLoading && <p className="text-small text-text-muted">Loading settings…</p>}

      {settingsQuery.isError && (
        <p className="text-small text-error">
          Could not load settings — check your connection and try again.
        </p>
      )}

      {settingsQuery.data && (
        <>
          <ProfileForm
            settings={settingsQuery.data}
            canEdit={canEditProfile}
            onSubmit={(values) => profileMutation.mutate(values)}
            isSubmitting={profileMutation.isPending}
            errorMessage={error.profile ?? null}
            successMessage={notice.profile ?? null}
          />

          <TaxConfigForm
            taxConfig={settingsQuery.data.taxConfig}
            onSubmit={(taxConfig) => taxConfigMutation.mutate(taxConfig)}
            isSubmitting={taxConfigMutation.isPending}
            errorMessage={error.taxConfig ?? null}
            successMessage={notice.taxConfig ?? null}
          />

          <DiscountPolicyForm
            threshold={settingsQuery.data.discountApprovalThreshold}
            onSubmit={(threshold) => discountMutation.mutate(threshold)}
            isSubmitting={discountMutation.isPending}
            errorMessage={error.discount ?? null}
            successMessage={notice.discount ?? null}
          />

          <PaymentModesForm
            enabledPaymentModes={settingsQuery.data.enabledPaymentModes}
            onSubmit={(modes) => paymentModesMutation.mutate(modes)}
            isSubmitting={paymentModesMutation.isPending}
            errorMessage={error.paymentModes ?? null}
            successMessage={notice.paymentModes ?? null}
          />
        </>
      )}
    </main>
  );
}
