"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingApi } from "@/lib/marketing/api";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import type { ConversationLiveEvent, ConversationStatus } from "@/lib/marketing/types";

const STATUS_FILTERS: { key: ConversationStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_human", label: "Needs You" },
  { key: "bot_active", label: "Bot handling" },
  { key: "human_active", label: "You're handling" },
  { key: "closed", label: "Closed" },
];

const STATUS_LABEL: Record<ConversationStatus, string> = {
  bot_active: "Bot handling",
  needs_human: "Needs You",
  human_active: "You're handling",
  closed: "Closed",
};

// "Needs You" reuses the brand kit's warning token (per the build brief —
// never a new color) so it reads as urgent alongside the KDS's own
// warning-tier tickets, not as a decorative status pill like the others.
const STATUS_BADGE: Record<ConversationStatus, string> = {
  bot_active: "bg-secondary/10 text-secondary",
  needs_human: "bg-warning/15 font-semibold text-warning",
  human_active: "bg-success/10 text-success",
  closed: "bg-border text-text-muted",
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * WhatsApp Inbox conversation list — contact name/phone, last message
 * preview, and a status badge, with "Needs You" made visually prominent
 * (left accent border + bold warning badge) since that's the one state
 * requiring a staff member's attention right now. Subscribes to both live
 * events (`whatsapp:message-received`/`whatsapp:handoff-needed`) and just
 * invalidates the list query on either — the whole point of this screen is
 * that a handoff shows up without a manual refresh.
 */
export function ConversationList({ onSelect }: { onSelect: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");

  const conversationsQuery = useQuery({
    queryKey: ["marketing-conversations", statusFilter],
    queryFn: () =>
      marketingApi.listConversations(statusFilter === "all" ? {} : { status: statusFilter, limit: 50 }),
  });

  const refreshList = () => queryClient.invalidateQueries({ queryKey: ["marketing-conversations"] });
  useSocketEvent<ConversationLiveEvent>("whatsapp:message-received", refreshList);
  useSocketEvent<ConversationLiveEvent>("whatsapp:handoff-needed", refreshList);

  const data = conversationsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 self-start rounded-xl border border-border bg-background p-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setStatusFilter(filter.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-small font-medium transition-colors ${
              statusFilter === filter.key
                ? "bg-surface text-primary shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {conversationsQuery.isLoading && (
        <p className="text-small text-text-muted">Loading conversations…</p>
      )}
      {conversationsQuery.isError && (
        <p className="text-small text-error">
          Could not load conversations — check your connection and try again.
        </p>
      )}

      {data && data.conversations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            {statusFilter === "all"
              ? "No WhatsApp conversations yet — they'll show up here once a customer messages you."
              : "No conversations in this state."}
          </p>
        </div>
      )}

      {data && data.conversations.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <ul className="divide-y divide-border">
            {data.conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-background ${
                    conversation.status === "needs_human" ? "border-l-4 border-warning bg-warning/5" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-text">{conversation.contactName}</p>
                    <p className="truncate text-small text-text-muted">{conversation.phone}</p>
                    <p className="mt-0.5 truncate text-small text-text-muted">
                      {conversation.lastMessagePreview}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-small ${STATUS_BADGE[conversation.status]}`}
                    >
                      {STATUS_LABEL[conversation.status]}
                    </span>
                    <span className="text-small text-text-muted">
                      {formatTimestamp(conversation.lastMessageAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
