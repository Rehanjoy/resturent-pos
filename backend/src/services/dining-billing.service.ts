import type { OrderDocument } from "../models/order.model";

export interface TaxRateInput {
  name: string;
  ratePercent: number;
}

export interface BillTaxLine extends TaxRateInput {
  amount: number;
}

function sumTaxLines(lines: BillTaxLine[]): BillTaxLine[] {
  const totals = new Map<string, BillTaxLine>();
  for (const line of lines) {
    const key = `${line.name}\u0000${line.ratePercent}`;
    const current = totals.get(key);
    if (current) current.amount += line.amount;
    else totals.set(key, { ...line });
  }
  return [...totals.values()];
}

export function taxForAmount(amount: number, taxConfig: TaxRateInput[]): BillTaxLine[] {
  return taxConfig.map((tax) => ({
    name: tax.name,
    ratePercent: tax.ratePercent,
    amount: Math.round((amount * tax.ratePercent) / 100),
  }));
}

/**
 * Produces the same integer-paise breakdown used by the guest session and
 * invoice creation. Original, active and cancelled values remain separate so
 * a guest can reconcile every rupee without reverse-engineering GST.
 */
export function calculateOrderBill(order: OrderDocument, taxConfig: TaxRateInput[]) {
  const itemsSubtotal = order.items.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);
  const cancelledItemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.priceSnapshot * (item.cancelledQty ?? 0),
    0,
  );
  const activeItemsSubtotal = itemsSubtotal - cancelledItemsSubtotal;
  const cancellations = order.cancellations ?? [];
  const cancellationBaseCharge = cancellations.reduce((sum, entry) => sum + entry.baseCharge, 0);
  const cancellationTaxLines = sumTaxLines(cancellations.flatMap((entry) => entry.taxLines));
  const activeTaxLines = taxForAmount(activeItemsSubtotal, taxConfig);
  const taxLines = sumTaxLines([...activeTaxLines, ...cancellationTaxLines]);
  const taxableSubtotal = activeItemsSubtotal + cancellationBaseCharge;
  const cancellationCharge = cancellationBaseCharge + cancellationTaxLines.reduce((sum, tax) => sum + tax.amount, 0);
  const totalDue = taxableSubtotal + taxLines.reduce((sum, tax) => sum + tax.amount, 0);

  return {
    itemsSubtotal,
    activeItemsSubtotal,
    cancelledItemsSubtotal,
    cancellationBaseCharge,
    taxableSubtotal,
    taxLines,
    cancellationTaxLines,
    cancellationCharge,
    totalDue,
    paymentDue: totalDue,
    explanation: "Total due = active items + cancellation policy charge + the listed taxes. All amounts are in paise.",
  };
}

export function aggregateTaxLines(lines: BillTaxLine[]) {
  return sumTaxLines(lines);
}
