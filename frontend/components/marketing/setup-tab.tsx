"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import { CheckCircleIcon, PhoneIcon } from "@/components/icons";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * WhatsApp connection Setup tab. Owner sees the connect/reconnect form;
 * Manager gets a read-only connected-status view (`canManage` gate,
 * mirroring `website-screen.tsx`'s Owner-full/Manager-view-only pattern).
 * The backend validates the phoneNumberId+accessToken pair against Meta's
 * Graph API before saving anything (`whatsapp-config.service.ts`
 * `saveWhatsappConfig`) — a bad pair never gets past this form with a
 * false "connected" state.
 */
export function SetupTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["marketing-whatsapp-config"],
    queryFn: () => marketingApi.getWhatsappConfig().then((result) => result.config),
  });

  const saveMutation = useMutation({
    mutationFn: () => marketingApi.saveWhatsappConfig({ phoneNumberId, accessToken, wabaId: wabaId || undefined }),
    onSuccess: () => {
      setFormError(null);
      setAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["marketing-whatsapp-config"] });
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not connect to WhatsApp.")),
  });

  if (configQuery.isLoading) {
    return <p className="text-small text-text-muted">Loading connection status…</p>;
  }

  if (configQuery.isError) {
    return (
      <p className="text-small text-error">
        Could not load the WhatsApp connection status — check your connection and try again.
      </p>
    );
  }

  const config = configQuery.data ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-text">Connection status</h2>

        {config?.isConnected ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-success/10 p-4">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-body font-medium text-text">
                Connected as {config.verifiedName || "your WhatsApp Business number"}
              </p>
              {config.displayPhoneNumber && (
                <p className="mt-0.5 flex items-center gap-1.5 text-small text-text-muted">
                  <PhoneIcon className="h-3.5 w-3.5" /> {config.displayPhoneNumber}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-small text-text-muted">
            Not connected yet. {canManage ? "Connect your WhatsApp Business number below." : "Ask an Owner to connect a WhatsApp Business number."}
          </p>
        )}
      </div>

      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
        >
          <h2 className="font-heading text-lg font-semibold text-text">
            {config?.isConnected ? "Reconnect / update" : "Connect WhatsApp"}
          </h2>
          <p className="text-small text-text-muted">
            From Meta&apos;s WhatsApp Business Platform (Meta Business Suite → WhatsApp Manager). We
            verify these with Meta before saving.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Phone Number ID</span>
            <input
              value={phoneNumberId}
              onChange={(event) => setPhoneNumberId(event.target.value)}
              required
              placeholder="e.g. 109876543210987"
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Access token</span>
            <input
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              required
              type="password"
              autoComplete="off"
              placeholder="Meta permanent access token"
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
            <span className="text-small text-text-muted">
              Stored encrypted — never shown again after you save it.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">WhatsApp Business Account ID (optional)</span>
            <input
              value={wabaId}
              onChange={(event) => setWabaId(event.target.value)}
              placeholder="e.g. 123456789012345"
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
          </label>

          {formError && <p className="text-small text-error">{formError}</p>}

          <button
            type="submit"
            disabled={saveMutation.isPending || !phoneNumberId.trim() || !accessToken.trim()}
            className="self-start rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? "Connecting…" : "Connect"}
          </button>
        </form>
      )}
    </div>
  );
}
