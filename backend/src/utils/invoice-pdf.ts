import PDFDocument from "pdfkit";
import type { Response } from "express";
import type { RestaurantDocument } from "../models/restaurant.model";
import type { InvoiceDto } from "../services/invoice.service";
import type { PaymentDto } from "../services/payment.service";

/**
 * Premium invoice PDF generator — pdfkit renders straight to a stream with
 * no headless browser/HTML step. Uses a rich visual design with properly
 * structured sections, decorative accent lines, and professional typography.
 *
 * Rupee amounts are rendered as "Rs 1,234.00" with comma formatting — pdfkit's
 * built-in Helvetica font doesn't ship the ₹ glyph, and embedding a custom
 * font just for one symbol isn't worth it for the MVP invoice.
 */

// ── Brand Colors ────────────────────────────────────────────────────────
const COLOR = {
  primary: "#d97706",      // Saffron / Amber
  primaryLight: "#fef3c7", // Light amber background
  dark: "#0f172a",         // Slate 900
  muted: "#64748b",        // Slate 500
  border: "#e2e8f0",       // Slate 200
  borderDark: "#cbd5e1",   // Slate 300
  surface: "#f8fafc",      // Crisp white
  white: "#ffffff",
  success: "#10b981",
  error: "#ef4444",
  voidRed: "#dc2626",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────
function formatRupees(paise: number): string {
  const rupees = (paise / 100).toFixed(2);
  // Add comma separators for Indian numbering (e.g. 1,23,456.00)
  const [whole, decimal] = rupees.split(".");
  const formatted = Number(whole).toLocaleString("en-IN");
  return `Rs ${formatted}.${decimal}`;
}

function formatDateTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}



// ── PDF Renderer ────────────────────────────────────────────────────────
export function streamInvoicePdf(
  res: Response,
  data: { restaurant: RestaurantDocument; invoice: InvoiceDto; payments: PaymentDto[] },
): void {
  const { restaurant, invoice, payments } = data;
  const pageWidth = 419; // A5 width in points
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const doc = new PDFDocument({ size: "A5", margin });
  doc.pipe(res);

  // ── Accent stripe at top ──────────────────────────────────────────
  doc.save();
  doc.rect(0, 0, pageWidth, 6).fill(COLOR.primary);
  doc.restore();

  // ── Header Section ────────────────────────────────────────────────
  let y = 20;

  // Restaurant name
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(COLOR.dark)
    .text(restaurant.name, margin, y, { align: "center", width: contentWidth });
  y = doc.y + 3;

  // Address line
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
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(addressLine, margin, y, { align: "center", width: contentWidth });
    y = doc.y + 2;
  }

  // GST Number
  if (restaurant.gstNumber) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLOR.muted)
      .text(`GSTIN: ${restaurant.gstNumber}`, margin, y, {
        align: "center",
        width: contentWidth,
      });
    y = doc.y + 2;
  }

  // ── Decorative divider ────────────────────────────────────────────
  y += 6;
  const dividerCenter = margin + contentWidth / 2;
  // Left line
  doc
    .moveTo(margin + 30, y)
    .lineTo(dividerCenter - 15, y)
    .strokeColor(COLOR.border)
    .lineWidth(0.5)
    .stroke();
  // Diamond shape at center
  doc.save();
  doc
    .moveTo(dividerCenter, y - 4)
    .lineTo(dividerCenter + 5, y)
    .lineTo(dividerCenter, y + 4)
    .lineTo(dividerCenter - 5, y)
    .closePath()
    .fill(COLOR.primary);
  doc.restore();
  // Right line
  doc
    .moveTo(dividerCenter + 15, y)
    .lineTo(margin + contentWidth - 30, y)
    .strokeColor(COLOR.border)
    .lineWidth(0.5)
    .stroke();

  y += 12;

  // ── Invoice title bar ─────────────────────────────────────────────
  doc.save();
  doc
    .roundedRect(margin, y, contentWidth, 28, 4)
    .fill(COLOR.primaryLight);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.primary)
    .text("TAX INVOICE", margin, y + 8, { align: "center", width: contentWidth });

  y += 36;

  // ── Invoice details (two column) ──────────────────────────────────
  const leftCol = margin;
  const rightCol = margin + contentWidth / 2 + 10;
  const detailFontSize = 8.5;

  // Left: Invoice # and Date
  doc.font("Helvetica").fontSize(detailFontSize).fillColor(COLOR.muted);
  doc.text("Invoice No.", leftCol, y);
  doc
    .font("Helvetica-Bold")
    .fillColor(COLOR.dark)
    .text(`#${invoice.invoiceNumber}`, leftCol, y + 11);

  // Right: Date
  doc.font("Helvetica").fillColor(COLOR.muted).text("Date & Time", rightCol, y);
  doc
    .font("Helvetica-Bold")
    .fillColor(COLOR.dark)
    .text(formatDateTime(invoice.createdAt), rightCol, y + 11);

  y += 30;

  // ── VOID stamp ────────────────────────────────────────────────────
  if (invoice.status === "void") {
    doc.save();
    doc
      .roundedRect(margin, y, contentWidth, 26, 4)
      .fillAndStroke("#fef2f2", COLOR.voidRed);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.voidRed)
      .text("VOID", margin, y + 7, { align: "center", width: contentWidth });
    doc.restore();
    y += 30;

    if (invoice.voidReason) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLOR.muted)
        .text(`Reason: ${invoice.voidReason}`, margin, y, { width: contentWidth });
      y = doc.y + 4;
    }
  }

  // ── Items Table ───────────────────────────────────────────────────
  y += 4;

  // Table header background
  doc.save();
  doc
    .roundedRect(margin, y, contentWidth, 20, 3)
    .fill(COLOR.dark);
  doc.restore();

  const col1 = margin + 8;
  const col2 = margin + contentWidth - 100;
  const col3 = margin + contentWidth - 50;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLOR.white);
  doc.text("ITEM", col1, y + 6, { width: 180 });
  doc.text("QTY", col2, y + 6, { width: 40, align: "center" });
  doc.text("AMOUNT", col3 - 5, y + 6, { width: 60, align: "right" });

  y += 24;

  // Table rows
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.dark);
  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i]!;
    const lineTotal = item.priceSnapshot * item.qty;

    // Alternate row background
    if (i % 2 === 0) {
      doc.save();
      doc.rect(margin, y - 2, contentWidth, 18).fill(COLOR.surface);
      doc.restore();
    }

    doc.fillColor(COLOR.dark).font("Helvetica").fontSize(9);
    doc.text(item.nameSnapshot, col1, y + 2, { width: 180 });
    doc.text(String(item.qty), col2, y + 2, { width: 40, align: "center" });
    doc.text(formatRupees(lineTotal), col3 - 5, y + 2, { width: 60, align: "right" });

    y += 18;
  }

  // Bottom border of items table
  y += 2;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(COLOR.borderDark)
    .lineWidth(1)
    .stroke();

  // ── Totals Section ────────────────────────────────────────────────
  y += 8;
  const totalsLabelX = margin + contentWidth - 160;
  const totalsValueX = margin + contentWidth - 60;
  const totalsValueW = 60;

  function totalsRow(label: string, value: string, isBold = false, color: string = COLOR.dark): void {
    doc
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isBold ? 10 : 9)
      .fillColor(COLOR.muted);
    doc.text(label, totalsLabelX, y, { width: 95 });
    doc
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(color);
    doc.text(value, totalsValueX, y, { width: totalsValueW, align: "right" });
    y += isBold ? 16 : 14;
  }

  totalsRow("Subtotal", formatRupees(invoice.subtotal));

  if (invoice.discount) {
    const label =
      invoice.discount.type === "percent"
        ? `Discount (${invoice.discount.value}%)`
        : "Discount";
    totalsRow(label, `-${formatRupees(invoice.discount.amountApplied)}`, false, COLOR.success as string);
  }

  for (const tax of invoice.taxLines) {
    totalsRow(`${tax.name} (${tax.ratePercent}%)`, formatRupees(tax.amount));
  }

  // Grand total divider
  y += 2;
  doc
    .moveTo(totalsLabelX, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(COLOR.primary)
    .lineWidth(1.5)
    .stroke();
  y += 8;

  // Grand total with highlight background
  doc.save();
  doc
    .roundedRect(totalsLabelX - 6, y - 4, contentWidth - totalsLabelX + margin + 6, 24, 4)
    .fill(COLOR.primaryLight);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.primary);
  doc.text("TOTAL", totalsLabelX, y + 2, { width: 95 });
  doc.text(formatRupees(invoice.total), totalsValueX, y + 2, {
    width: totalsValueW,
    align: "right",
  });
  y += 28;

  // ── Payment Section ───────────────────────────────────────────────
  y += 6;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.dark);
  doc.text("PAYMENT DETAILS", margin, y);
  y += 14;

  doc
    .moveTo(margin, y - 2)
    .lineTo(margin + 120, y - 2)
    .strokeColor(COLOR.primary)
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.dark);
  if (payments.length === 0) {
    doc.text("Payment pending.", margin, y + 2);
    y += 14;
  } else {
    for (const payment of payments) {
      const modeLabel = payment.mode.toUpperCase();
      doc.font("Helvetica").fillColor(COLOR.muted).text(`${modeLabel}:`, margin, y + 2, { continued: true });
      doc.font("Helvetica-Bold").fillColor(COLOR.dark).text(` ${formatRupees(payment.amount)}`);
      y += 14;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────
  y += 16;

  // Decorative divider
  doc
    .moveTo(margin + 60, y)
    .lineTo(margin + contentWidth - 60, y)
    .strokeColor(COLOR.border)
    .lineWidth(0.5)
    .stroke();
  y += 10;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLOR.dark)
    .text("Thank you for dining with us!", margin, y, {
      align: "center",
      width: contentWidth,
    });
  y += 14;

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLOR.muted)
    .text("This is a computer-generated invoice.", margin, y, {
      align: "center",
      width: contentWidth,
    });
  y += 10;

  // Bottom accent stripe
  doc.save();
  doc
    .roundedRect(margin + contentWidth / 2 - 30, y + 4, 60, 3, 1.5)
    .fill(COLOR.primary);
  doc.restore();

  // Powered by Saffron
  y += 14;
  doc
    .fontSize(7)
    .fillColor(COLOR.muted)
    .text("Powered by Saffron POS", margin, y, { align: "center", width: contentWidth });

  doc.end();
}
