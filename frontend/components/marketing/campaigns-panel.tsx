"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingApi } from "@/lib/marketing/api";
import { PlusIcon } from "@/components/icons";
import { CampaignTable } from "./campaign-table";
import { NewCampaignModal } from "./new-campaign-modal";

/**
 * Campaign list + "New Campaign" entry point. Selecting a campaign is
 * handled one level up (`campaigns-tab.tsx`), which swaps this panel for
 * `CampaignDetail` — kept out of this component so the list/detail
 * navigation state lives in exactly one place.
 */
export function CampaignsPanel({ onSelectCampaign }: { onSelectCampaign: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);

  const campaignsQuery = useQuery({
    queryKey: ["marketing-campaigns", page],
    queryFn: () => marketingApi.listCampaigns({ page, limit: 20 }),
  });
  const data = campaignsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">Campaigns</h2>
          <p className="text-small text-text-muted">
            Send a WhatsApp broadcast to your contacts using an approved template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewCampaignOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-button text-white"
        >
          <PlusIcon className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {campaignsQuery.isLoading && <p className="text-small text-text-muted">Loading campaigns…</p>}
      {campaignsQuery.isError && (
        <p className="text-small text-error">
          Could not load campaigns — check your connection and try again.
        </p>
      )}

      {data && data.campaigns.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">No campaigns yet — send your first broadcast.</p>
        </div>
      )}

      {data && data.campaigns.length > 0 && (
        <>
          <CampaignTable campaigns={data.campaigns} onSelect={onSelectCampaign} />

          {data.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-6 py-4 shadow-sm">
              <p className="text-small font-medium text-text-muted">
                Page <span className="font-bold text-text">{data.page}</span> of{" "}
                <span className="font-bold text-text">{data.totalPages}</span> · {data.total} campaigns
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isNewCampaignOpen && (
        <NewCampaignModal
          onClose={() => setIsNewCampaignOpen(false)}
          onCreated={(campaign) => {
            setIsNewCampaignOpen(false);
            queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
            onSelectCampaign(campaign.id);
          }}
        />
      )}
    </div>
  );
}
