"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellIcon, CheckCircleIcon } from "@/components/icons";
import { notificationsApi } from "@/lib/notifications/api";
import type { NotificationCategory, StaffNotification } from "@/lib/notifications/types";
import { connectSocket } from "@/lib/socket";

const FILTERS: { id: NotificationCategory | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "orders", label: "Orders" }, { id: "kitchen", label: "Kitchen" },
  { id: "service", label: "Guest calls" }, { id: "billing", label: "Billing" },
];
const PRIORITY_STYLES = {
  info: "border-white/85 bg-white/72",
  action: "border-info/25 bg-white/80",
  required: "border-warning/35 bg-white/84",
  urgent: "border-error/35 bg-white/88 shadow-[0_12px_30px_rgba(220,38,38,.10)]",
};
const PRIORITY_LABELS = { info: "Update", action: "Action", required: "Required", urgent: "Urgent" };
const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  orders: "Order", kitchen: "Kitchen", service: "Guest request", billing: "Billing", system: "System",
};

function relativeTime(value: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function playAttentionTone() {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(960, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + 0.25);
  oscillator.addEventListener("ended", () => void context.close());
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [now, setNow] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const countsQuery = useQuery({ queryKey: ["notification-counts"], queryFn: notificationsApi.unreadCounts, refetchInterval: 30_000, retry: false });
  const listQuery = useQuery({ queryKey: ["notifications", category], queryFn: () => notificationsApi.list({ category: category === "all" ? undefined : category }), enabled: open, refetchInterval: open ? 30_000 : false, retry: false });

  const refreshNotifications = useCallback(async (notificationId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notification-counts"] }), queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["kitchenTickets"] }), queryClient.invalidateQueries({ queryKey: ["orders-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["order"] }), queryClient.invalidateQueries({ queryKey: ["tables"] }),
      queryClient.invalidateQueries({ queryKey: ["dining-floor"] }), queryClient.invalidateQueries({ queryKey: ["service-requests"] }),
    ]);
    if (!notificationId) return;
    const latest = await notificationsApi.list({ limit: 10 }).catch(() => null);
    const notification = latest?.notifications.find((item) => item.id === notificationId);
    if (!notification) return;
    toast(notification.title, { description: notification.message, duration: notification.priority === "urgent" ? 12_000 : 7_000, action: { label: "View", onClick: () => setOpen(true) } });
    if (soundEnabled && notification.priority === "urgent") playAttentionTone();
  }, [queryClient, soundEnabled]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      setSoundEnabled(window.localStorage.getItem("saffron-notification-sound") === "on");
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    const onNotification = (payload: { notificationId?: string }) => void refreshNotifications(payload.notificationId);
    const onConnect = () => void refreshNotifications();
    socket.on("notification:new", onNotification); socket.on("connect", onConnect);
    return () => { socket.off("notification:new", onNotification); socket.off("connect", onConnect); };
  }, [refreshNotifications]);

  useEffect(() => {
    const recover = () => { if (document.visibilityState === "visible") void refreshNotifications(); };
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => { window.removeEventListener("focus", recover); document.removeEventListener("visibilitychange", recover); };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [open]);

  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => void refreshNotifications() });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => void refreshNotifications() });
  const unread = countsQuery.data?.total ?? 0;

  const drawer = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label="Close notifications"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-[#211916]/55 backdrop-blur-sm"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        aria-describedby="notification-summary"
        className="glass-elevated absolute inset-y-0 right-0 flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border-l border-white/85 pb-[env(safe-area-inset-bottom)] sm:inset-y-3 sm:right-3 sm:h-[calc(100dvh-1.5rem)] sm:max-w-[29rem] sm:rounded-[2rem] sm:border"
      >
        <header className="shrink-0 border-b border-white/80 bg-white/55 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl sm:rounded-t-[2rem] sm:px-5 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" /><span className="relative h-2 w-2 rounded-full bg-primary" /></span>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Live operations</p>
              </div>
              <h2 id="notification-title" className="font-heading text-h3 font-semibold leading-tight text-text">Notifications</h2>
              <p id="notification-summary" aria-live="polite" className="mt-1 text-small text-text-muted">{unread ? `${unread} item${unread === 1 ? "" : "s"} need attention` : "You are all caught up"}</p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Close notification panel" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/85 bg-white/75 text-xl leading-none text-text-muted shadow-sm transition hover:bg-white hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">×</button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" aria-pressed={soundEnabled} onClick={() => { const next = !soundEnabled; setSoundEnabled(next); window.localStorage.setItem("saffron-notification-sound", next ? "on" : "off"); if (next) playAttentionTone(); }} className="min-h-10 rounded-full border border-white/85 bg-white/65 px-3 py-2 text-xs font-semibold text-text-muted shadow-sm transition hover:bg-white hover:text-text">Sound {soundEnabled ? "on" : "off"}</button>
            <button type="button" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()} className="min-h-10 rounded-xl px-3 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40">{markAll.isPending ? "Marking…" : "Mark all read"}</button>
          </div>
          <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Notification categories">
            {FILTERS.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={category === filter.id} onClick={() => setCategory(filter.id)} className={`min-h-10 shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${category === filter.id ? "bg-primary text-white shadow-[0_8px_18px_rgba(242,68,5,.22)]" : "border border-white/75 bg-white/55 text-text-muted hover:bg-white hover:text-text"}`}>{filter.label}{filter.id !== "all" && countsQuery.data?.byCategory[filter.id] ? ` ${countsQuery.data.byCategory[filter.id]}` : ""}</button>)}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/25 p-3 sm:p-4" tabIndex={0}>
          {listQuery.isLoading ? <NotificationSkeleton /> : listQuery.isError ? <PanelMessage text="Could not load notifications." action="Retry" onAction={() => void listQuery.refetch()} /> : !listQuery.data?.notifications.length ? <PanelMessage text="No notifications in this category." /> : <div className="space-y-3 pb-2">{listQuery.data.notifications.map((item) => <NotificationItem key={item.id} item={item} now={now} onRead={() => markRead.mutate(item.id)} onNavigate={() => { if (!item.read) markRead.mutate(item.id); setOpen(false); }} />)}</div>}
        </div>
      </aside>
    </div>,
    document.body,
  ) : null;

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label={`Open notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/90 bg-white/62 text-text-muted shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/90 hover:text-primary active:translate-y-0">
      <BellIcon className="h-4 w-4" />{unread > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white ring-2 ring-surface">{unread > 99 ? "99+" : unread}</span> : null}
    </button>
    {drawer}
  </>;
}

function NotificationItem({ item, now, onRead, onNavigate }: { item: StaffNotification; now: number; onRead: () => void; onNavigate: () => void }) {
  return <article className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md ${PRIORITY_STYLES[item.priority]} ${item.read ? "opacity-75" : ""}`}>
    {!item.read ? <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${item.priority === "urgent" ? "bg-error" : item.priority === "required" ? "bg-warning" : "bg-primary"}`} aria-hidden="true" /> : null}
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-white/80 bg-white/65 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">{CATEGORY_LABELS[item.category]}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${item.priority === "urgent" ? "bg-error/10 text-error" : item.priority === "required" ? "bg-warning/15 text-warning" : "bg-primary/8 text-primary"}`}>{PRIORITY_LABELS[item.priority]}</span>
      </div>
      <time className="shrink-0 pt-1 text-[11px] font-medium text-text-muted" dateTime={item.createdAt}>{relativeTime(item.createdAt, now)}</time>
    </div>
    <h3 className="mt-3 break-words text-small font-semibold leading-5 text-text">{item.title}</h3>
    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-text-muted">{item.message}</p>
    {item.context?.tableLabel || item.context?.chairLabel ? <div className="mt-3 flex flex-wrap gap-2">{item.context.tableLabel ? <span className="rounded-lg bg-text/5 px-2.5 py-1.5 text-[11px] font-semibold text-text">Table {item.context.tableLabel}</span> : null}{item.context.chairLabel ? <span className="rounded-lg bg-text/5 px-2.5 py-1.5 text-[11px] font-semibold text-text">Seat {item.context.chairLabel}</span> : null}</div> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/45 pt-3">
      {item.actionUrl ? <Link href={item.actionUrl} onClick={onNavigate} className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">View details</Link> : null}
      {!item.read ? <button type="button" onClick={onRead} className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-primary transition hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><CheckCircleIcon className="h-4 w-4" />Mark as read</button> : <span className="flex items-center gap-1.5 text-[11px] font-medium text-success"><CheckCircleIcon className="h-4 w-4" />Read</span>}
    </div>
  </article>;
}

function NotificationSkeleton() { return <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-white/80 bg-white/55 backdrop-blur-xl" />)}</div>; }
function PanelMessage({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) { return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/90 bg-white/48 px-6 text-center backdrop-blur-xl"><BellIcon className="h-7 w-7 text-text-muted" /><p className="mt-3 text-small text-text-muted">{text}</p>{action ? <button type="button" onClick={onAction} className="mt-3 min-h-10 rounded-lg border border-border px-4 text-small font-semibold text-primary">{action}</button> : null}</div>; }
