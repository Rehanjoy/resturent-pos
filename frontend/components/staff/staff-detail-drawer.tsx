"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { staffApi } from "@/lib/staff/api";
import type { StaffMember } from "@/lib/staff/types";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** "order.void" / "LOGIN_SUCCESS" -> "Order void" / "Login success". */
function formatAction(action: string): string {
  const words = action.replace(/[._]/g, " ").toLowerCase().split(" ").filter(Boolean);
  return words.map((word, index) => (index === 0 ? word[0].toUpperCase() + word.slice(1) : word)).join(" ");
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const PAGE_SIZE = 15;

/**
 * Per-staff detail drawer (PRD §3.11 activity log + PRD §3.1 session
 * management). A right-hand overlay panel rather than the shared `Modal`
 * primitive — this needs to be wide enough for a log feed and session
 * list, which the centered `max-w-md` modal shell isn't sized for.
 */
export function StaffDetailDrawer({
  staff,
  canManage,
  onClose,
}: {
  staff: StaffMember;
  canManage: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const activityQuery = useQuery({
    queryKey: ["staff-activity-log", staff.id, page],
    queryFn: () => staffApi.activityLog(staff.id, page, PAGE_SIZE),
  });

  const sessionsQuery = useQuery({
    queryKey: ["staff-sessions", staff.id],
    queryFn: () => staffApi.sessions(staff.id),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => staffApi.revokeSession(staff.id, sessionId),
    onSuccess: () => {
      setRevokeError(null);
      queryClient.invalidateQueries({ queryKey: ["staff-sessions", staff.id] });
    },
    onError: (error) => setRevokeError(errorMessageOf(error, "Could not revoke this session.")),
  });

  const logs = activityQuery.data?.logs ?? [];
  const total = activityQuery.data?.total ?? 0;
  const hasNextPage = page * PAGE_SIZE < total;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto border-l border-border bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${staff.name} detail`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-h2 font-semibold text-text">{staff.name}</h2>
            <p className="text-small capitalize text-text-muted">
              {staff.role.replace("_", " ")} · {staff.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text"
          >
            &#x2715;
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-h4 font-semibold text-text">Active Sessions</h3>

          {sessionsQuery.isLoading && (
            <p className="text-small text-text-muted">Loading sessions…</p>
          )}
          {sessionsQuery.isError && (
            <p className="text-small text-error">
              Could not load sessions — check your connection and try again.
            </p>
          )}
          {revokeError && <p className="text-small text-error">{revokeError}</p>}

          {sessionsQuery.data && sessionsQuery.data.sessions.length === 0 && (
            <p className="text-small text-text-muted">No sessions recorded for this account.</p>
          )}

          {sessionsQuery.data && sessionsQuery.data.sessions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {sessionsQuery.data.sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-small text-text">
                      {session.userAgent ?? "Unknown device"}
                    </p>
                    <p className="text-small text-text-muted">
                      {session.ipAddress ?? "Unknown IP"} · signed in {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  {session.isActive ? (
                    canManage && (
                      <button
                        type="button"
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                        className="shrink-0 rounded-md border border-error px-3 py-1.5 text-small text-error disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    )
                  ) : (
                    <span className="shrink-0 text-small text-text-muted">
                      {session.revokedAt ? "Revoked" : "Expired"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-h4 font-semibold text-text">Activity Log</h3>

          {activityQuery.isLoading && (
            <p className="text-small text-text-muted">Loading activity…</p>
          )}
          {activityQuery.isError && (
            <p className="text-small text-error">
              Could not load activity — check your connection and try again.
            </p>
          )}
          {activityQuery.data && logs.length === 0 && (
            <p className="text-small text-text-muted">No recorded activity yet.</p>
          )}

          {logs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {logs.map((entry) => (
                <li key={entry.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body font-medium text-text">{formatAction(entry.action)}</span>
                    <span className="shrink-0 text-small text-text-muted">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-small text-text-muted">{entry.entityType}</p>
                </li>
              ))}
            </ul>
          )}

          {(page > 1 || hasNextPage) && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="text-small text-secondary hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
              >
                Previous
              </button>
              <span className="text-small text-text-muted">Page {page}</span>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNextPage}
                className="text-small text-secondary hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
