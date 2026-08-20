"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import type { AiConfig } from "@/lib/marketing/types";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { CheckCircleIcon } from "@/components/icons";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * AI auto-reply settings — lives in the Setup tab, right below the
 * WhatsApp connection card (`setup-tab.tsx`), since both are "connect a
 * third-party credential + configure how this restaurant uses it" cards.
 * Same Owner-edits/Manager-views-only split as the WhatsApp connection
 * card (`canManage`, passed down from `marketing-screen.tsx`'s
 * `MANAGE_WHATSAPP_ROLES` gate) — the Gemini key and the auto-reply
 * on/off switch are the same "identity/cost-level decision" category.
 */
export function AiSettingsPanel({ canManage }: { canManage: boolean }) {
  const configQuery = useQuery({
    queryKey: ["marketing-ai-config"],
    queryFn: () => marketingApi.getAiConfig().then((result) => result.config),
  });

  if (configQuery.isLoading) {
    return <p className="text-small text-text-muted">Loading AI settings…</p>;
  }

  if (configQuery.isError) {
    return (
      <p className="text-small text-error">
        Could not load AI settings — check your connection and try again.
      </p>
    );
  }

  // Keyed on whether a config exists yet so the form below fully remounts
  // (fresh `useState` initial values from the freshly-loaded config)
  // exactly once when the query first resolves — the same "seed local form
  // state from already-loaded data via a key, not an Effect" pattern as
  // `contact-form-modal.tsx`, rather than syncing state in a `useEffect`.
  return (
    <AiSettingsCard
      key={configQuery.data ? "loaded" : "empty"}
      config={configQuery.data ?? null}
      canManage={canManage}
    />
  );
}

function AiSettingsCard({ config, canManage }: { config: AiConfig | null; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [systemPromptExtra, setSystemPromptExtra] = useState(config?.systemPromptExtra ?? "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(config?.autoReplyEnabled ?? false);
  const [maxAutoReplies, setMaxAutoReplies] = useState(config?.maxAutoRepliesPerConversation ?? 5);
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      marketingApi.saveAiConfig({
        geminiApiKey: geminiApiKey || undefined,
        systemPromptExtra,
        autoReplyEnabled,
        maxAutoRepliesPerConversation: maxAutoReplies,
      }),
    onSuccess: () => {
      setFormError(null);
      setGeminiApiKey("");
      queryClient.invalidateQueries({ queryKey: ["marketing-ai-config"] });
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not save AI settings.")),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-text">AI auto-reply</h2>
        <p className="mt-1 text-small text-text-muted">
          Let Gemini answer common WhatsApp questions (hours, menu, prices) automatically, and hand
          tricky conversations — reservations, complaints, anything it&apos;s unsure about — to your
          team.
        </p>

        {config?.hasGeminiApiKey ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-success/10 p-4">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-body font-medium text-text">
                Gemini API key saved · Auto-reply {config.autoReplyEnabled ? "on" : "off"}
              </p>
              <p className="mt-0.5 text-small text-text-muted">
                Up to {config.maxAutoRepliesPerConversation} automatic replies per conversation before
                handing off to your team.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-small text-text-muted">
            {canManage
              ? "No Gemini API key saved yet. Add one below to turn on auto-reply."
              : "Ask an Owner to add a Gemini API key to turn on auto-reply."}
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
          <h2 className="font-heading text-lg font-semibold text-text">AI settings</h2>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Gemini API key</span>
            <input
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
              type="password"
              autoComplete="off"
              placeholder={config?.hasGeminiApiKey ? "Saved — leave blank to keep it" : "Paste your Gemini API key"}
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
            <span className="text-small text-text-muted">
              From Google AI Studio. Stored encrypted — never shown again after you save it.
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <div>
              <p className="text-body font-medium text-text">Turn on auto-reply</p>
              <p className="text-small text-text-muted">
                The bot only replies inside the reply cap below, and always hands off on
                reservations, complaints, or requests for a person.
              </p>
            </div>
            <ToggleSwitch checked={autoReplyEnabled} onChange={setAutoReplyEnabled} label="Turn on AI auto-reply" />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Max automatic replies per conversation</span>
            <input
              value={maxAutoReplies}
              onChange={(event) => setMaxAutoReplies(Number(event.target.value) || 1)}
              type="number"
              min={1}
              max={50}
              className="w-32 rounded-lg border border-border px-3 py-2 text-body text-text"
            />
            <span className="text-small text-text-muted">
              After this many replies in a row, the conversation hands off to your team automatically.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Extra notes for the AI (optional)</span>
            <textarea
              value={systemPromptExtra}
              onChange={(event) => setSystemPromptExtra(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={'e.g. "We\'re closed on Mondays." / "Mention our new biryani."'}
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
            <span className="text-small text-text-muted">
              Added on top of your restaurant name, address, and current menu — never replaces them.
            </span>
          </label>

          {formError && <p className="text-small text-error">{formError}</p>}

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="self-start rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving…" : "Save AI settings"}
          </button>
        </form>
      )}
    </div>
  );
}
