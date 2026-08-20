"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import { TemplateTable } from "./template-table";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Templates sub-view (Campaigns tab). Read-only list of the WABA's
 * approved-or-not templates, synced on demand from Meta — this app never
 * creates a template itself (`message-template.service.ts`'s doc comment).
 */
export function TemplatesPanel({ onGoToSetup }: { onGoToSetup: () => void }) {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["marketing-whatsapp-config"],
    queryFn: () => marketingApi.getWhatsappConfig().then((result) => result.config),
  });
  const templatesQuery = useQuery({
    queryKey: ["marketing-templates"],
    queryFn: () => marketingApi.listMessageTemplates().then((result) => result.templates),
  });

  const syncMutation = useMutation({
    mutationFn: () => marketingApi.syncMessageTemplates(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-templates"] }),
  });

  const isConnected = configQuery.data?.isConnected ?? false;
  const templates = templatesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">Message templates</h2>
          <p className="text-small text-text-muted">
            Pre-approved WhatsApp templates synced from your connected Meta WhatsApp Business account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={!isConnected || syncMutation.isPending}
          className="rounded-lg bg-accent px-3.5 py-2 text-button text-white disabled:opacity-60"
        >
          {syncMutation.isPending ? "Syncing…" : "Sync from WhatsApp"}
        </button>
      </div>

      {syncMutation.isError && (
        <p className="text-small text-error">
          {errorMessageOf(syncMutation.error, "Could not sync templates.")}
        </p>
      )}
      {syncMutation.isSuccess && syncMutation.data && (
        <p className="text-small text-success">
          Synced {syncMutation.data.total} template(s) — {syncMutation.data.created} new,{" "}
          {syncMutation.data.updated} updated.
        </p>
      )}

      {templatesQuery.isLoading && <p className="text-small text-text-muted">Loading templates…</p>}
      {templatesQuery.isError && (
        <p className="text-small text-error">
          Could not load templates — check your connection and try again.
        </p>
      )}

      {templatesQuery.isSuccess && templates.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          {!isConnected ? (
            <p className="text-body text-text-muted">
              Connect WhatsApp first to sync your approved templates.{" "}
              <button type="button" onClick={onGoToSetup} className="font-medium text-primary underline">
                Go to Setup
              </button>
            </p>
          ) : (
            <p className="text-body text-text-muted">
              No templates synced yet. Approve a template in Meta WhatsApp Manager, then sync.
            </p>
          )}
        </div>
      )}

      {templates.length > 0 && <TemplateTable templates={templates} />}
    </div>
  );
}
