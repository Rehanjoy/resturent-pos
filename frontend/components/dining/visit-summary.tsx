import type { DiningSessionResponse } from "@/lib/dining/types";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function VisitSummary({ data, now }: { data: DiningSessionResponse; now: number }) {
  const started = Date.parse(data.session.createdAt);
  const ended = data.session.releasedAt ? Date.parse(data.session.releasedAt) : now;
  const minutes = Number.isFinite(started) ? Math.max(0, Math.floor((ended - started) / 60000)) : 0;

  return (
    <Card className="mx-auto mt-5 max-w-2xl rounded-3xl">
      <div className="grid grid-cols-2 items-center gap-3 p-4 text-center">
        <div>
          <span className="block text-xs text-text-muted">Time at table</span>
          <strong className="mt-1 block tabular-nums">{Math.floor(minutes / 60)}h {minutes % 60}m</strong>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Separator orientation="vertical" className="h-10" />
          <div>
            <span className="block text-xs text-text-muted">Amount due</span>
            <strong className="mt-1 block">{formatMoney(data.bill?.paymentDue ?? data.order?.amountDue ?? data.order?.customerTotal ?? data.order?.subtotal ?? 0)}</strong>
          </div>
        </div>
      </div>
    </Card>
  );
}
