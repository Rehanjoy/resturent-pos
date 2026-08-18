import { formatMoney } from "@/lib/format";
import type { Invoice } from "@/lib/billing/types";

/**
 * Renders exactly what the backend computed — subtotal, discount, tax
 * lines, total — with no tax/discount math duplicated on the frontend
 * (`invoice.service.ts` owns that calculation).
 */
export function TaxSummary({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="mb-1 text-small font-semibold uppercase tracking-wide text-text-muted">
        Bill Summary
      </h3>
      <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
      {invoice.discount && (
        <Row
          label={
            invoice.discount.type === "percent"
              ? `Discount (${invoice.discount.value}%)`
              : "Discount"
          }
          value={`-${formatMoney(invoice.discount.amountApplied)}`}
        />
      )}
      {invoice.taxLines.map((tax) => (
        <Row key={tax.name} label={`${tax.name} (${tax.ratePercent}%)`} value={formatMoney(tax.amount)} />
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
        <span className="text-body font-semibold text-text">Total</span>
        <span className="font-heading text-h3 font-semibold text-text">{formatMoney(invoice.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-small">
      <span className="text-text-muted">{label}</span>
      <span className="text-numeric text-text">{value}</span>
    </div>
  );
}
