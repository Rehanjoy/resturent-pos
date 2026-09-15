"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellIcon, CheckCircleIcon, ClockIcon, ReceiptIcon, WaterIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { diningApi } from "@/lib/dining/api";
import type { DiningNotification } from "@/lib/dining/types";
import { DiningSheet } from "./dining-sheet";

function mergeNotifications(current: DiningNotification[], incoming: DiningNotification[]) {
  const byId = new Map(current.map((notification) => [notification.id, notification]));
  for (const notification of incoming) byId.set(notification.id, notification);
  return [...byId.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

function displayTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(date);
}

function categoryIcon(category: string) {
  if (category === "service") return WaterIcon;
  if (category === "billing") return ReceiptIcon;
  if (category === "orders" || category === "kitchen") return ClockIcon;
  return BellIcon;
}

function eventLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notificationTone(notification: DiningNotification) {
  if (notification.priority === "urgent" || notification.priority === "high") {
    return "border-red-200 bg-red-50/70 text-error";
  }
  if (notification.category === "billing" || notification.eventType.includes("completed")) {
    return "border-emerald-200 bg-emerald-50/70 text-success";
  }
  if (notification.eventType.includes("ready")) {
    return "border-amber-200 bg-amber-50/70 text-amber-900";
  }
  return "border-border bg-white text-primary";
}

export function GuestNotificationCenter({
  qrToken,
  sessionToken,
  active,
  onAction,
}: {
  qrToken: string;
  sessionToken: string;
  active: boolean;
  onAction: (notification: DiningNotification) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DiningNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const seenIds = useRef(new Set<string>());

  const loadLatest = useCallback(async () => {
    try {
      const page = await diningApi.notifications(qrToken, sessionToken);
      const unseen = initialized.current
        ? page.notifications.filter((notification) => !notification.read && !seenIds.current.has(notification.id))
        : [];
      for (const notification of page.notifications) seenIds.current.add(notification.id);
      setNotifications((current) => mergeNotifications(current, page.notifications));
      setUnreadCount(page.unreadCount);
      setNextCursor(page.nextCursor);
      setError(null);

      if (unseen.length > 0 && document.visibilityState === "visible") {
        const newest = unseen.sort(
          (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
        )[0];
        if (newest) {
          toast(newest.title, {
            id: "guest-live-activity",
            description: newest.message,
            duration: 6500,
            action: {
              label: "View",
              onClick: () => setOpen(true),
            },
          });
          document.title = `${newest.title} · Saffron`;
        }
      }
      initialized.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live activity is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [qrToken, sessionToken]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLatest(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadLatest]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadLatest();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [active, loadLatest]);

  async function markRead(notification: DiningNotification, runAction = false) {
    if (notification.read) {
      if (runAction) {
        setOpen(false);
        onAction(notification);
      }
      return;
    }

    setNotifications((current) =>
      current.map((item) => item.id === notification.id ? { ...item, read: true } : item),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await diningApi.markNotificationRead(qrToken, sessionToken, notification.id);
      if (runAction) {
        setOpen(false);
        onAction(notification);
      }
    } catch (cause) {
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, read: false } : item),
      );
      setUnreadCount((current) => current + 1);
      setError(cause instanceof Error ? cause.message : "Could not mark this update as read.");
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((notification) => !notification.read);
    if (!unread.length) return;
    const results = await Promise.allSettled(
      unread.map((notification) =>
        diningApi.markNotificationRead(qrToken, sessionToken, notification.id),
      ),
    );
    const completedIds = new Set(
      results.flatMap((result, index) => result.status === "fulfilled" ? [unread[index]!.id] : []),
    );
    setNotifications((current) =>
      current.map((notification) =>
        completedIds.has(notification.id) ? { ...notification, read: true } : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - completedIds.size));
    if (completedIds.size !== unread.length) {
      setError("Some updates could not be marked as read. Please try again.");
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await diningApi.notifications(qrToken, sessionToken, {
        cursor: nextCursor,
        limit: 30,
      });
      for (const notification of page.notifications) seenIds.current.add(notification.id);
      setNotifications((current) => mergeNotifications(current, page.notifications));
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load earlier activity.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={unreadCount > 0 ? `Activity, ${unreadCount} unread updates` : "Activity"}
        className="relative gap-2 border-white/85 bg-white/68 shadow-sm backdrop-blur-xl"
      >
        <BellIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Activity</span>
        {unreadCount > 0 && (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <DiningSheet title="Your activity" onClose={() => setOpen(false)}>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Live visit updates</p>
                <p className="text-xs text-text-muted">Kitchen, payment and waiter activity in one place</p>
              </div>
              {unreadCount > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()}>
                  Mark all read
                </Button>
              )}
            </div>

            {error && (
              <div role="alert" className="glass-panel rounded-2xl border-error/20 p-3 text-sm text-error">
                {error}
                <button type="button" onClick={() => void loadLatest()} className="ml-2 font-semibold underline">Retry</button>
              </div>
            )}

            {loading ? (
              <div role="status" className="space-y-3">
                {[1, 2, 3].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="glass-panel rounded-2xl border-dashed p-8 text-center">
                <CheckCircleIcon className="mx-auto h-8 w-8 text-success" />
                <p className="mt-3 font-semibold">You’re all caught up</p>
                <p className="mt-1 text-sm text-text-muted">Order and service updates will appear here.</p>
              </div>
            ) : (
              <ol className="space-y-3" aria-label="Visit activity, newest first">
                {notifications.map((notification) => {
                  const NotificationIcon = categoryIcon(notification.category);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => void markRead(notification, true)}
                        className={`relative flex min-h-24 w-full items-start gap-3 rounded-2xl border p-3 text-left shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${notificationTone(notification)}`}
                      >
                        <span className="mt-0.5 rounded-xl bg-white p-2 shadow-sm"><NotificationIcon className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-text">{notification.title}</strong>
                            {!notification.read && <span className="h-2 w-2 rounded-full bg-info" aria-label="Unread" />}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-text-muted">{notification.message}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-text-muted">
                            <Badge variant="outline">{eventLabel(notification.eventType)}</Badge>
                            <time dateTime={notification.createdAt}>{displayTime(notification.createdAt)}</time>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {nextCursor && (
              <Button type="button" variant="outline" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Loading…" : "Load earlier activity"}
              </Button>
            )}
          </div>
        </DiningSheet>
      )}
    </>
  );
}
