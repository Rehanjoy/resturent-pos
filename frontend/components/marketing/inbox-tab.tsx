"use client";

import { useState } from "react";
import { ConversationList } from "./conversation-list";
import { ConversationDetail } from "./conversation-detail";

/**
 * Marketing screen's "Inbox" tab (Part 3 of 3). List/detail navigation
 * state lives here, same pattern as `campaigns-tab.tsx`'s
 * `selectedCampaignId`.
 */
export function InboxTab() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  if (selectedConversationId) {
    return (
      <ConversationDetail
        conversationId={selectedConversationId}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  return <ConversationList onSelect={setSelectedConversationId} />;
}
