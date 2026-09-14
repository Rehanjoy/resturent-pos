"use client";
import { useEffect, useState } from "react";
import { diningApi } from "@/lib/dining/api";
import type { ServiceRequest, ServiceRequestType } from "@/lib/dining/types";
import { HelpIcon, ReceiptIcon, WaterIcon, type IconProps } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const options: { type: ServiceRequestType; icon: (props: IconProps) => React.ReactElement; label: string }[] = [
  { type: "water", icon: WaterIcon, label: "Water" },
  { type: "bill", icon: ReceiptIcon, label: "Ask for bill" },
  { type: "help", icon: HelpIcon, label: "Call waiter" },
];

export function GuestService({ qrToken, token, active }: { qrToken: string; token: string; active: boolean }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [busy, setBusy] = useState<ServiceRequestType | null>(null);
  const [message, setMessage] = useState("");

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

  async function request(type: ServiceRequestType) {
    setBusy(type);
    setMessage("");
    try {
      const item = await diningApi.requestService(qrToken, token, type);
      setRequests((current) => [item, ...current.filter((row) => row.id !== item.id)]);
      setMessage(item.status === "acknowledged" ? "A waiter is already on the way." : "Request sent to the floor team.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mx-auto mt-5 max-w-2xl rounded-3xl p-5" aria-label="Table service">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Need something?</h2>
          <p className="mt-1 text-xs text-text-muted">Tap once. Your table and reserved chairs light up for staff.</p>
        </div>
        {open.length > 0 && (
          <Badge variant="warning">{open.some((item) => item.status === "acknowledged") ? "Waiter on the way" : "Sent"}</Badge>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {options.map((option) => {
          const existing = open.find((item) => item.type === option.type);
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              type="button"
              disabled={!active || busy !== null || Boolean(existing)}
              onClick={() => void request(option.type)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-xs font-semibold transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-55"
            >
              <Icon className="h-5 w-5" />
              {existing ? (existing.status === "acknowledged" ? "On the way" : "Requested") : busy === option.type ? "Sending…" : option.label}
            </button>
          );
        })}
      </div>

      {message && <p role="status" className="mt-3 text-sm text-text-muted">{message}</p>}
    </Card>
  );
}
