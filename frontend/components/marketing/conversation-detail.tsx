"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import { useSocketEvent } from "@/lib/hooks/use-socket-event";
import type { ConversationLiveEvent, ConversationStatus } from "@/lib/marketing/types";
import { BotIcon, ChevronLeftIcon, SendIcon } from "@/components/icons";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  bot_active: "Bot handling",
  needs_human: "Needs You",
  human_active: "You're handling",
  closed: "Closed",
};

/**
 * One conversation's full chat history + reply box. Customer messages are
 * left-aligned, bot/staff replies right-aligned with a small "Bot"/"Staff"
 * label so it's always clear who said what (the per-message log only
 * records *what kind* of sender replied, `senderType`, not which
 * individual staff member — `assignedStaffId` on the conversation itself
 * is who's currently responsible for it).
 *
 * Live updates: both `whatsapp:message-received` and
 * `whatsapp:handoff-needed` are filtered to this exact conversation id and
 * just invalidate the two queries that matter (this conversation's detail,
 * and the list, so its preview/badge stay in sync too) — no polling.
 */
export function ConversationDetail({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const detailQuery = useQuery({
    queryKey: ["marketing-conversation", conversationId],
    queryFn: () => marketingApi.getConversation(conversationId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-conversation", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["marketing-conversations"] });
  };
  useSocketEvent<ConversationLiveEvent>("whatsapp:message-received", (event) => {
    if (event.conversationId === conversationId) refresh();
  });
  useSocketEvent<ConversationLiveEvent>("whatsapp:handoff-needed", (event) => {
    if (event.conversationId === conversationId) refresh();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detailQuery.data?.messages.length]);

  const replyMutation = useMutation({
    mutationFn: (text: string) => marketingApi.replyToConversation(conversationId, text),
    onSuccess: () => {
      setReplyText("");
      setActionError(null);
      refresh();
    },
    onError: (error) => setActionError(errorMessageOf(error, "Could not send the reply.")),
  });

  const closeMutation = useMutation({
    mutationFn: () => marketingApi.closeConversation(conversationId),
    onSuccess: refresh,
    onError: (error) => setActionError(errorMessageOf(error, "Could not close this conversation.")),
  });

  const handBackMutation = useMutation({
    mutationFn: () => marketingApi.handBackToBot(conversationId),
    onSuccess: refresh,
    onError: (error) => setActionError(errorMessageOf(error, "Could not hand this back to the bot.")),
  });

  if (detailQuery.isLoading) {
    return <p className="text-small text-text-muted">Loading conversation…</p>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <p className="text-small text-error">
        Could not load this conversation — check your connection and try again.
      </p>
    );
  }

  const { conversation, messages } = detailQuery.data;
  const isClosed = conversation.status === "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-small font-medium text-text-muted transition-colors hover:text-text"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back to conversations
        </button>
        <div className="flex gap-2">
          {conversation.status !== "bot_active" && !isClosed && (
            <button
              type="button"
              onClick={() => handBackMutation.mutate()}
              disabled={handBackMutation.isPending}
              className="rounded-lg border border-border px-3.5 py-2 text-button text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              Hand back to bot
            </button>
          )}
          {!isClosed && (
            <button
              type="button"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="rounded-lg border border-border px-3.5 py-2 text-button text-text-muted transition-colors hover:text-error disabled:opacity-50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div>
          <p className="font-heading text-lg font-semibold text-text">{conversation.contactName}</p>
          <p className="text-small text-text-muted">{conversation.phone}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-small ${
            conversation.status === "needs_human"
              ? "bg-warning/15 font-semibold text-warning"
              : "bg-background text-text-muted"
          }`}
        >
          {STATUS_LABEL[conversation.status]}
        </span>
      </div>

      <div className="flex max-h-[28rem] min-h-[16rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-background p-4">
        {messages.length === 0 && <p className="text-small text-text-muted">No messages yet.</p>}
        {messages.map((message) => {
          const isCustomer = message.direction === "inbound";
          return (
            <div key={message.id} className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}>
              {!isCustomer && (
                <span className="mb-1 flex items-center gap-1 text-small text-text-muted">
                  {message.senderType === "bot" && <BotIcon className="h-3.5 w-3.5" />}
                  {message.senderType === "bot" ? "Bot" : "Staff"}
                </span>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-body ${
                  isCustomer ? "bg-surface text-text shadow-sm" : "bg-primary text-white"
                }`}
              >
                {message.messageText || "(no text)"}
                {message.status === "failed" && (
                  <p className="mt-1 text-small text-white/80">Not delivered</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {actionError && <p className="text-small text-error">{actionError}</p>}

      {!isClosed ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = replyText.trim();
            if (!trimmed) return;
            replyMutation.mutate(trimmed);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            rows={2}
            placeholder="Type a reply…"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-body text-text"
          />
          <button
            type="submit"
            disabled={replyMutation.isPending || !replyText.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-button text-white disabled:opacity-60"
          >
            <SendIcon className="h-4 w-4" /> Send
          </button>
        </form>
      ) : (
        <p className="text-small text-text-muted">This conversation is closed.</p>
      )}
    </div>
  );
}
