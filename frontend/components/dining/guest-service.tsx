"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { diningApi } from "@/lib/dining/api";
import type { ServiceRequest, ServiceRequestType } from "@/lib/dining/types";
import { HelpIcon, ReceiptIcon, WaterIcon, type IconProps } from "@/components/icons";

const leadingServiceOptions: { type: ServiceRequestType; icon: (props: IconProps) => React.ReactElement; label: string; sentLabel: string }[] = [
  { type: "help", icon: HelpIcon, label: "Call Waiter", sentLabel: "Requested" },
  { type: "water", icon: WaterIcon, label: "Water", sentLabel: "Requested" },
];
const billOption: { type: ServiceRequestType; icon: (props: IconProps) => React.ReactElement; label: string; sentLabel: string } =
  { type: "bill", icon: ReceiptIcon, label: "Bill", sentLabel: "Requested" };

function ServiceButton({ option, existing, active, busy, onRequest }: {
  option: typeof leadingServiceOptions[number];
  existing?: ServiceRequest;
  active: boolean;
  busy: ServiceRequestType | null;
  onRequest: (type: ServiceRequestType, label: string) => void;
}) {
  const acknowledged = existing?.status === "acknowledged";
  const Icon = option.icon;
  return (
    <button
      type="button"
      disabled={!active || busy !== null || Boolean(existing)}
      onClick={() => onRequest(option.type, option.label)}
      className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 py-2 text-[11px] font-semibold transition-colors ${
        existing ? (acknowledged ? "bg-success/10 text-success" : "bg-warning/15 text-text") : "text-text-muted hover:bg-background hover:text-primary"
      } disabled:pointer-events-none disabled:opacity-100`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">
        {existing ? (acknowledged ? "On the way" : option.sentLabel) : busy === option.type ? "Sending…" : option.label}
      </span>
    </button>
  );
}

/**
 * Fixed mobile-app-style bottom nav for the active dining visit: Call
 * Waiter, Water, Bill. Replaces the earlier inline "Need something?" card —
 * same `diningApi.requestService` plumbing, restyled as a persistent footer
 * so it never scrolls out of reach. "Add Item" lives in the header instead,
 * so it isn't duplicated here.
 */
export function GuestService({ qrToken, token, active }: { qrToken: string; token: string; active: boolean }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [busy, setBusy] = useState<ServiceRequestType | null>(null);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const value = await diningApi.serviceRequests(qrToken, token);
        if (mounted) setRequests(value);
      } catch { /* Main session poll reports connectivity. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [active, qrToken, token]);

  const open = requests.filter((item) => item.status === "pending" || item.status === "acknowledged");

  async function request(type: ServiceRequestType, label: string) {
    setBusy(type);
    try {
      const item = await diningApi.requestService(qrToken, token, type);
      setRequests((current) => [item, ...current.filter((row) => row.id !== item.id)]);
      toast(item.status === "acknowledged" ? "A waiter is already on the way." : `${label} sent to the floor team.`, { id: `guest-service-${type}` });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the request.", { id: `guest-service-${type}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <nav
      id="guest-service"
      aria-label="Table service and ordering actions"
      className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 sm:px-4"
    >
      <div className="glass-elevated mx-auto flex max-w-xl items-stretch gap-1.5 rounded-[1.75rem] border border-white/85 p-1.5 shadow-[0_18px_45px_rgba(28,25,23,0.16)]">
        {leadingServiceOptions.map((option) => (
          <ServiceButton key={option.type} option={option} existing={open.find((item) => item.type === option.type)} active={active} busy={busy} onRequest={(type, label) => void request(type, label)} />
        ))}

        <ServiceButton option={billOption} existing={open.find((item) => item.type === billOption.type)} active={active} busy={busy} onRequest={(type, label) => void request(type, label)} />
      </div>
    </nav>
  );
}
