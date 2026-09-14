"use client";

import { useMemo, useState } from "react";
import { DiningSheet } from "./dining-sheet";
import { remainingTime } from "@/lib/dining/api";
import type { DiningPolicy, DiningSessionResponse, DiningTaxConfig, SelectedCancellationQuote } from "@/lib/dining/types";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

export function CancellationPolicy({ policy }: { policy: DiningPolicy }) {
  return (
    <Card className="rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Cancellation policy</p>
      <h3 className="mt-1 font-heading text-lg font-semibold">You always see the charge first</h3>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-success/10 px-2 py-3">
          <strong className="block text-success">Free</strong>
          <span className="mt-1 block text-[10px] leading-tight text-text-muted">First {policy.freeCancellationMinutes} min</span>
        </div>
        <div className="rounded-2xl bg-warning/15 px-2 py-3">
          <strong className="block">{policy.partialChargePercent}%</strong>
          <span className="mt-1 block text-[10px] leading-tight text-text-muted">Until {policy.partialCancellationMinutes} min</span>
        </div>
        <div className="rounded-2xl bg-background px-2 py-3">
          <strong className="block">100%</strong>
          <span className="mt-1 block text-[10px] leading-tight text-text-muted">After {policy.partialCancellationMinutes} min</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">Each selected item is checked against its own order time. Applicable tax is shown before you confirm.</p>
    </Card>
  );
}

function BillBreakdown({ data, taxConfig = [] }: { data: DiningSessionResponse; taxConfig?: DiningTaxConfig[] }) {
  const order = data.order!;
  const bill = data.bill;
  const subtotal = bill?.activeItemsSubtotal ?? order.subtotal;
  const fallbackTaxes = taxConfig.map((tax) => ({ name: tax.name, ratePercent: tax.ratePercent, amount: Math.round(subtotal * tax.ratePercent / 100) }));
  const combinedTaxLines = bill?.taxLines ?? order.taxLines ?? fallbackTaxes;
  const cancellationTaxLines = bill?.cancellationTaxLines ?? [];
  const taxLines = bill
    ? combinedTaxLines
        .map((line) => ({ ...line, amount: line.amount - (cancellationTaxLines.find((cancelTax) => cancelTax.name === line.name && cancelTax.ratePercent === line.ratePercent)?.amount ?? 0) }))
        .filter((line) => line.amount > 0)
    : combinedTaxLines;
  const discount = order.discount?.amount ?? 0;
  const cancellationBase = bill?.cancellationBaseCharge ?? order.cancellationCharge ?? order.cancellation?.amountDue ?? 0;
  const total = bill?.totalDue ?? order.amountDue ?? order.customerTotal ?? subtotal - discount + taxLines.reduce((sum, line) => sum + line.amount, 0) + cancellationBase;

  return (
    <Card className="overflow-hidden rounded-3xl p-0" aria-labelledby="bill-title">
      <div className="bg-text px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Pay at counter</p>
            <h2 id="bill-title" className="mt-1 font-heading text-lg font-semibold">Your bill so far</h2>
          </div>
          <strong className="text-xl">{formatMoney(total)}</strong>
        </div>
      </div>
      <div className="space-y-3 p-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">Active food items</span>
          <span className="font-medium">{formatMoney(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between gap-4 text-success">
            <span>{order.discount?.label || "Discount"}</span>
            <span>−{formatMoney(discount)}</span>
          </div>
        )}
        {taxLines.map((line, index) => (
          <div key={`${line.name}-${index}`} className="flex justify-between gap-4">
            <span className="text-text-muted">{line.name}{line.ratePercent !== undefined ? ` (${line.ratePercent}%)` : ""}</span>
            <span className="font-medium">{formatMoney(line.amount)}</span>
          </div>
        ))}
        {cancellationBase > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Cancellation base charge</span>
            <span className="font-medium">{formatMoney(cancellationBase)}</span>
          </div>
        )}
        {cancellationTaxLines.map((line, index) => (
          <div key={`cancel-tax-${line.name}-${index}`} className="flex justify-between gap-4">
            <span className="text-text-muted">{line.name} on cancellation{line.ratePercent !== undefined ? ` (${line.ratePercent}%)` : ""}</span>
            <span className="font-medium">{formatMoney(line.amount)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-border pt-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <strong>Amount due</strong>
              <p className="mt-1 text-[11px] text-text-muted">No online payment taken</p>
            </div>
            <strong className="text-xl text-primary">{formatMoney(bill?.paymentDue ?? total)}</strong>
          </div>
        </div>
        <div className="rounded-2xl bg-background p-3 text-xs leading-relaxed text-text-muted">
          {bill
            ? `Active food ${formatMoney(subtotal)} + active tax ${formatMoney(taxLines.reduce((sum, line) => sum + line.amount, 0))} + cancellation ${formatMoney(bill.cancellationCharge)} = ${formatMoney(total)}.`
            : `Food ${formatMoney(subtotal)}${taxLines.length ? ` + tax ${formatMoney(taxLines.reduce((sum, line) => sum + line.amount, 0))}` : ""}${cancellationBase ? ` + cancellation ${formatMoney(cancellationBase)}` : ""} = ${formatMoney(total)}.`}
        </div>
      </div>
    </Card>
  );
}

const ITEM_STATUS_LABEL: Record<string, string> = {
  ready: "Ready to serve",
  served: "Served — enjoy",
  pending: "Queued in kitchen",
  sent: "Queued in kitchen",
};

export function OrderTracker({ data, now, policy, busy, error, taxConfig, onAddItems, onQuote, onCancel }: {
  data: DiningSessionResponse; now: number; policy: DiningPolicy; busy: boolean; error: string | null; taxConfig?: DiningTaxConfig[]; onAddItems: () => void;
  onQuote: (items: { orderItemId: string; qty: number }[]) => Promise<SelectedCancellationQuote>;
  onCancel: (reason: string, items: { orderItemId: string; qty: number; acceptedChargePercent: number }[]) => Promise<boolean>;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<SelectedCancellationQuote | null>(null);
  const [acceptedAmount, setAcceptedAmount] = useState<number | null>(null);
  const order = data.order;
  const options = useMemo(() => new Map((data.cancellationOptions ?? []).map((option) => [option.orderItemId, option.availableQty])), [data.cancellationOptions]);
  if (!order) return null;
  const wholeOrderCancelled = order.status === "void" || Boolean(order.cancellation);
  const cancellable = order.items.filter((item) => {
    const activeQty = item.qty - (item.cancelledQty ?? 0);
    return activeQty > 0 && (options.size > 0 ? (options.get(item.id) ?? 0) > 0 : !["served", "cancelled", "void"].includes(item.itemStatus));
  });
  const selected = Object.entries(selection).filter(([, qty]) => qty > 0).map(([orderItemId, qty]) => ({ orderItemId, qty }));
  async function reviewCancellation() {
    if (selected.length) {
      const next = await onQuote(selected);
      setQuote(next);
      setAcceptedAmount(null);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 pb-8">
      <div className="overflow-hidden rounded-[2rem] bg-text text-white shadow-[0_20px_60px_rgba(28,25,23,0.12)]">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Order #{order.id.slice(-6).toUpperCase()}</p>
              <h1 className="mt-2 font-heading text-2xl font-semibold">
                {wholeOrderCancelled ? "Cancellation recorded" : order.status === "closed" ? "Thanks for visiting" : "Your kitchen timeline"}
              </h1>
            </div>
            <Badge variant="outline" className="border-white/20 bg-white/10 text-white capitalize">{order.status.replaceAll("_", " ")}</Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            {wholeOrderCancelled ? "Your cancelled order and payable charge remain visible below." : "Track every dish, add more whenever you like, or cancel only the items you select."}
          </p>
        </div>
        {!wholeOrderCancelled && (
          <div className="grid grid-cols-2 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              disabled={data.canAddItems === false}
              onClick={onAddItems}
              className="h-14 rounded-none border-r border-white/10 px-4 text-white hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              ＋ Add more items
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!cancellable.length}
              onClick={() => { setShowCancel(true); setQuote(null); setAcceptedAmount(null); }}
              className="h-14 rounded-none px-4 text-white hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              Cancel selected items
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden rounded-3xl p-0">
        {order.items.map((item) => {
          const cancelledQty = item.cancelledQty ?? 0;
          const activeQty = Math.max(0, item.qty - cancelledQty);
          const ready = item.itemStatus === "ready" || item.itemStatus === "served";
          const estimate = item.estimatedReadyAt ? Date.parse(item.estimatedReadyAt) : null;
          const start = item.sentAt ? Date.parse(item.sentAt) : null;
          const progress = ready ? 100 : estimate && start && estimate > start ? Math.max(3, Math.min(95, ((now - start) / (estimate - start)) * 100)) : 5;
          return (
            <article key={item.id} className="border-b border-border p-5 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{item.nameSnapshot}</h2>
                  <p className="mt-1 text-xs text-text-muted">{activeQty > 0 ? `${activeQty} active × ${formatMoney(item.priceSnapshot)}` : "No active quantity"}</p>
                  {item.notes && <p className="mt-1 text-xs text-text-muted">{item.notes}</p>}
                </div>
                <strong className="shrink-0 text-sm">{formatMoney(item.priceSnapshot * activeQty)}</strong>
              </div>

              {cancelledQty > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-error/5 px-3 py-2 text-xs">
                  <span className="font-semibold text-error">{cancelledQty} cancelled</span>
                  <span className="text-text-muted line-through">{formatMoney(item.priceSnapshot * cancelledQty)}</span>
                </div>
              )}

              {activeQty > 0 && !wholeOrderCancelled && (
                <>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                    <span className={ready ? "font-semibold text-success" : "font-semibold text-text-muted"}>
                      {ITEM_STATUS_LABEL[item.itemStatus] ?? "Being prepared"}
                    </span>
                    <span className="tabular-nums text-text-muted">
                      {ready ? "✓" : estimate ? (now < estimate ? `About ${remainingTime(item.estimatedReadyAt, now)}` : "Taking a little longer") : "Kitchen confirming time"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className={`h-full rounded-full ${ready ? "bg-success" : "bg-primary"}`} style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </Card>

      {Boolean(order.cancellations?.length) && (
        <Card className="rounded-3xl border-error/15 p-5" aria-labelledby="cancelled-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-error">Recorded</p>
              <h2 id="cancelled-title" className="mt-1 font-heading text-lg font-semibold">Cancelled items</h2>
            </div>
            <Badge variant="error">{order.cancellations!.reduce((sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + line.qty, 0), 0)} item(s)</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {order.cancellations!.flatMap((entry) => entry.lines.map((line) => (
              <div key={`${entry.id ?? entry.cancelledAt}-${line.orderItemId}`} className="rounded-2xl bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <strong className="text-sm">{line.qty}× {line.nameSnapshot}</strong>
                    <p className="mt-1 text-xs text-text-muted">{line.chargePercent === 0 ? "Free cancellation" : `${line.chargePercent}% cancellation charge`} · {entry.reason}</p>
                  </div>
                  <strong className="text-sm">{formatMoney(line.amountDue)}</strong>
                </div>
              </div>
            )))}
          </div>
        </Card>
      )}

      <BillBreakdown data={data} taxConfig={taxConfig} />
      {!wholeOrderCancelled && <CancellationPolicy policy={policy} />}

      {showCancel && (
        <DiningSheet title="Choose items to cancel" onClose={() => { if (!busy) setShowCancel(false); }}>
          <p className="text-sm leading-relaxed text-text-muted">Select the exact quantity. Nothing is cancelled until you review the live charge and confirm.</p>

          <div className="my-5 space-y-3">
            {cancellable.map((item) => {
              const max = Math.min(item.qty - (item.cancelledQty ?? 0), options.get(item.id) ?? Number.MAX_SAFE_INTEGER);
              const qty = selection[item.id] ?? 0;
              return (
                <div key={item.id} className={`rounded-2xl border p-4 ${qty ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{item.nameSnapshot}</h3>
                      <p className="mt-1 text-xs text-text-muted">{max} available · {formatMoney(item.priceSnapshot)} each</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-surface shadow-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Cancel one fewer ${item.nameSnapshot}`}
                        disabled={qty === 0 || busy}
                        onClick={() => { setSelection((current) => ({ ...current, [item.id]: qty - 1 })); setQuote(null); }}
                      >
                        −
                      </Button>
                      <strong className="w-7 text-center text-sm">{qty}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Cancel one more ${item.nameSnapshot}`}
                        disabled={qty >= max || busy}
                        onClick={() => { setSelection((current) => ({ ...current, [item.id]: qty + 1 })); setQuote(null); }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!cancellable.length && (
            <p className="rounded-2xl bg-background p-5 text-sm text-text-muted">These items are already served or cannot be cancelled online. Please call a waiter.</p>
          )}

          {!quote ? (
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full bg-text hover:bg-text/90"
              disabled={!selected.length || busy}
              onClick={() => void reviewCancellation()}
            >
              {busy ? "Checking live charge…" : `Review charge for ${selected.reduce((sum, item) => sum + item.qty, 0)} item(s)`}
            </Button>
          ) : (
            <>
              <div className="rounded-2xl bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">Charge review</p>
                <div className="mt-3 space-y-3">
                  {quote.lines.map((line) => (
                    <div key={line.orderItemId} className="flex items-start justify-between gap-4 text-sm">
                      <div>
                        <strong>{line.qty}× {line.nameSnapshot}</strong>
                        <p className="text-xs text-text-muted">{line.chargePercent === 0 ? "Free cancellation" : `${line.chargePercent}% charge`} · value {formatMoney(line.subtotal)}</p>
                      </div>
                      <strong>{formatMoney(line.amountDue)}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t border-dashed border-border pt-3 text-sm">
                  <div className="flex justify-between text-text-muted">
                    <span>Selected item value</span>
                    <span>{formatMoney(quote.totals.selectedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Base charge</span>
                    <span>{formatMoney(quote.totals.baseCharge)}</span>
                  </div>
                  {quote.totals.taxLines.map((line, index) => (
                    <div key={`${line.name}-${index}`} className="flex justify-between text-text-muted">
                      <span>{line.name}{line.ratePercent !== undefined ? ` (${line.ratePercent}%)` : ""}</span>
                      <span>{formatMoney(line.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
                    <span>Amount due</span>
                    <span>{formatMoney(quote.totals.amountDue)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="cancel-reason" className="mb-2 font-semibold">Why are you cancelling?</Label>
                <textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="A short reason helps the kitchen"
                  maxLength={300}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus-visible:border-primary"
                />
              </div>

              <label className="my-4 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedAmount === quote.totals.amountDue}
                  onChange={(event) => setAcceptedAmount(event.target.checked ? quote.totals.amountDue : null)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>I understand that <strong>{formatMoney(quote.totals.amountDue)}</strong> will remain payable at the counter.</span>
              </label>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full"
                disabled={busy || !reason.trim() || acceptedAmount !== quote.totals.amountDue}
                onClick={async () => {
                  const request = quote.lines.map((line) => ({ orderItemId: line.orderItemId, qty: line.qty, acceptedChargePercent: line.chargePercent }));
                  if (await onCancel(reason.trim(), request)) setShowCancel(false);
                  else setAcceptedAmount(null);
                }}
              >
                {busy ? "Cancelling selected items…" : `Confirm cancellation · ${formatMoney(quote.totals.amountDue)}`}
              </Button>
            </>
          )}
        </DiningSheet>
      )}
    </section>
  );
}
