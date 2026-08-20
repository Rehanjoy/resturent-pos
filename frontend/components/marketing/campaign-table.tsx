"use client";

import type { CampaignStatus, MarketingCampaign } from "@/lib/marketing/types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  sending: "Sending",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft: "bg-border text-text-muted",
  sending: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  failed: "bg-error/10 text-error",
};

/**
 * Campaign list table — name, status, the four running counts, created
 * date. Clicking a row opens `CampaignDetail` (`campaigns-panel.tsx`).
 */
export function CampaignTable({
  campaigns,
  onSelect,
}: {
  campaigns: MarketingCampaign[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Recipients</th>
            <th className="px-4 py-3">Sent</th>
            <th className="px-4 py-3">Delivered</th>
            <th className="px-4 py-3">Read</th>
            <th className="px-4 py-3">Failed</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.id}
              onClick={() => onSelect(campaign.id)}
              className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-background"
            >
              <td className="px-4 py-3 font-medium text-text">{campaign.name}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-small font-medium ${STATUS_BADGE[campaign.status]}`}
                >
                  {STATUS_LABEL[campaign.status]}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{campaign.recipientCount}</td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{campaign.sentCount}</td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{campaign.deliveredCount}</td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{campaign.readCount}</td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{campaign.failedCount}</td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
