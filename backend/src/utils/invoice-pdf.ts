import PDFDocument from "pdfkit";
import type { Response } from "express";
import type { RestaurantDocument } from "../models/restaurant.model";
import type { InvoiceDto } from "../services/invoice.service";
import type { PaymentDto } from "../services/payment.service";

/**
 * The "print via thermal/ESC-POS printer or save/download" requirement
 * (PRD §3.10) is scoped to the downloadable PDF only for this MVP part —
 * pdfkit renders straight to a stream with no headless browser/HTML step,
 * which is the lightest-weight way to get a real PDF out of Node. Direct
 * ESC-POS/network-printer integration (PRD §3.14 "Printer configuration")
 * is a documented future item, not attempted here.
 *
 * Rupee amounts are rendered as "Rs 1234.00" rather than the "₹" glyph:
 * pdfkit's built-in Helvetica font doesn't ship the Rupee sign, and
 * embedding a custom font just for one symbol isn't worth it for the MVP
 * invoice — a real deployment can swap in a Unicode-complete font later.
 */
function formatRupees(paise: number): string {
  return `Rs ${(paise / 100).toFixed(2)}`;
}

export function streamInvoicePdf(
  res: Response,
  data: { restaurant: RestaurantDocument; invoice: InvoiceDto; payments: PaymentDto[] },
): void {
  const { restaurant, invoice, payments } = data;
  const doc = new PDFDocument({ size: "A5", margin: 40 });
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").text(restaurant.name, { align: "center" });

  const addressLine = [
    restaurant.address?.line1,
    restaurant.address?.line2,
    restaurant.address?.city,
    restaurant.address?.state,
    restaurant.address?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  if (addressLine) {
    doc.fontSize(9).font("Helvetica").text(addressLine, { align: "center" });
  }
  if (restaurant.gstNumber) {
    doc.fontSize(9).text(`GSTIN: ${restaurant.gstNumber}`, { align: "center" });
  }

  doc.moveDown(1);
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`Invoice #${invoice.invoiceNumber}`, { continued: true })
    .font("Helvetica")
    .fontSize(9)
    .text(`   ${new Date(invoice.createdAt).toLocaleString()}`);

  if (invoice.status === "void") {
    doc.moveDown(0.3).fillColor("red").fontSize(12).font("Helvetica-Bold").text("VOID");
    if (invoice.voidReason) {
      doc.fontSize(9).font("Helvetica").text(`Reason: ${invoice.voidReason}`);
    }
    doc.fillColor("black");
  }

  doc.moveDown(0.8);
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Item", 40, doc.y, { continued: true, width: 260 });
  doc.text("Qty", 260, doc.y, { continued: true, width: 60, align: "right" });
  doc.text("Amount", 320, doc.y, { width: 130, align: "right" });
  doc.moveDown(0.2);
  doc
    .moveTo(40, doc.y)
    .lineTo(450, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(10);
  for (const item of invoice.items) {
    const lineTotal = item.priceSnapshot * item.qty;
    const y = doc.y;
    doc.text(item.nameSnapshot, 40, y, { width: 260 });
    doc.text(String(item.qty), 260, y, { width: 60, align: "right" });
    doc.text(formatRupees(lineTotal), 320, y, { width: 130, align: "right" });
    doc.moveDown(0.2);
  }

  doc.moveDown(0.5);
  doc
    .moveTo(40, doc.y)
    .lineTo(450, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  function totalsRow(label: string, value: string, bold = false): void {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, 260, doc.y, { continued: true, width: 100 });
    doc.text(value, 320, doc.y, { width: 130, align: "right" });
  }

  totalsRow("Subtotal", formatRupees(invoice.subtotal));
  if (invoice.discount) {
    const label =
      invoice.discount.type === "percent" ? `Discount (${invoice.discount.value}%)` : "Discount";
    totalsRow(label, `-${formatRupees(invoice.discount.amountApplied)}`);
  }
  for (const tax of invoice.taxLines) {
    totalsRow(`${tax.name} (${tax.ratePercent}%)`, formatRupees(tax.amount));
  }
  doc.moveDown(0.2);
  totalsRow("Total", formatRupees(invoice.total), true);

  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(10).text("Payment", 40);
  doc.font("Helvetica").fontSize(9);
  if (payments.length === 0) {
    doc.text("Payment pending.", 40);
  } else {
    for (const payment of payments) {
      doc.text(`${payment.mode.toUpperCase()}: ${formatRupees(payment.amount)}`, 40);
    }
  }

  doc.moveDown(1.5);
  doc.fontSize(8).fillColor("#999999").text("Powered by Saffron", { align: "center" });

  doc.end();
}
