"use client";

import { useState } from "react";
import { TemplatesPanel } from "./templates-panel";
import { CampaignsPanel } from "./campaigns-panel";
import { CampaignDetail } from "./campaign-detail";

type SubView = "campaigns" | "templates";

const SUB_TABS: { key: SubView; label: string }[] = [
  { key: "campaigns", label: "Campaigns" },
  { key: "templates", label: "Templates" },
];

/**
 * Marketing screen's "Campaigns" tab (Part 2 of 3). Contains two
 * sub-views — Campaigns (list/new/detail) and Templates (Meta's synced
 * template catalog) — plus the campaign-detail drill-in, all owned here so
 * `marketing-screen.tsx` only needs one top-level tab entry for this whole
 * broadcast feature set (matching the build brief's "extend the existing
 * tab shell" instruction rather than adding two more top-level tabs).
 */
export function CampaignsTab({ onGoToSetup }: { onGoToSetup: () => void }) {
  const [subView, setSubView] = useState<SubView>("campaigns");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  if (selectedCampaignId) {
    return <CampaignDetail campaignId={selectedCampaignId} onBack={() => setSelectedCampaignId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 self-start rounded-xl border border-border bg-background p-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubView(tab.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-small font-medium transition-colors ${
              subView === tab.key
                ? "bg-surface text-primary shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subView === "campaigns" && <CampaignsPanel onSelectCampaign={setSelectedCampaignId} />}
      {subView === "templates" && <TemplatesPanel onGoToSetup={onGoToSetup} />}
    </div>
  );
}
