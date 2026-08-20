"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { SetupTab } from "./setup-tab";
import { ContactsTab } from "./contacts-tab";

// Marketing module is Owner/Manager only, no other role gets a nav entry
// or access at all (see `frontend/components/layout/sidebar.tsx`). Within
// that: both roles can view everything, but only Owner can edit the
// WhatsApp connection (`setup-tab.tsx` `canManage`) — mirroring Website
// Builder's Owner-full/Manager-view-only split for identity-level
// settings, not the usual "Manager can edit operational stuff" pattern.
const VIEW_ROLES = new Set(["owner", "manager"]);
const MANAGE_WHATSAPP_ROLES = new Set(["owner"]);

// This is Part 1 of 3 — Part 2 appends "campaigns" here (broadcast +
// analytics), Part 3 appends "inbox" (AI auto-reply). Kept as a literal
// union now so adding a tab later is a one-line type + array change, not a
// restructure.
type TabKey = "setup" | "contacts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "contacts", label: "Contacts" },
];

export function MarketingScreen() {
  const { user } = useAuth();
  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManageWhatsapp = !!user && MANAGE_WHATSAPP_ROLES.has(user.role);
  const [activeTab, setActiveTab] = useState<TabKey>("setup");

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You don&apos;t have access to Marketing.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Marketing"
        subtitle="WhatsApp marketing via Meta's official WhatsApp Business Cloud API."
      />

      <div className="flex flex-wrap gap-1 self-start rounded-2xl border border-border bg-surface p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-small font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-background hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "setup" && <SetupTab canManage={canManageWhatsapp} />}
      {activeTab === "contacts" && <ContactsTab />}
    </main>
  );
}
