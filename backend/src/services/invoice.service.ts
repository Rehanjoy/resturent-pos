import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { comparePassword } from "../utils/password";
import { User } from "../models/user.model";
import { Restaurant, type RestaurantDocument } from "../models/restaurant.model";
import { Order } from "../models/order.model";
import {
  Invoice,
  type InvoiceDocument,
  type InvoiceStatus,
  type DiscountType,
} from "../models/invoice.model";
import { Payment } from "../models/payment.model";
import { getNextSequence } from "../models/counter.model";
import { toOrderDto } from "./order.service";
import { toPaymentDto, type PaymentDto } from "./payment.service";
import { emitToRestaurant } from "../sockets";
import { recordAuditLog } from "./audit-log.service";

export interface InvoiceItemDto {
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
}

export interface InvoiceDiscountDto {
  type: DiscountType;
  value: number;
  amountApplied: number;
  approvedByStaffId?: string;
}

export interface InvoiceTaxLineDto {
  name: string;
  ratePercent: number;
  amount: number;
}

export interface InvoiceDto {
  id: string;
  restaurantId: string;
  orderId: string;
  invoiceNumber: number;
  items: InvoiceItemDto[];
  subtotal: number;
  discount?: InvoiceDiscountDto;
  taxLines: InvoiceTaxLineDto[];
  total: number;
  status: InvoiceStatus;
  voidReason?: string;
  voidedByStaffId?: string;
  createdByStaffId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountInput {
  type: DiscountType;
  value: number;
}

export interface GenerateInvoiceInput {
  discount?: DiscountInput;
  approverEmail?: string;
  approverPassword?: string;
}

export function toInvoiceDto(invoice: HydratedDocument<InvoiceDocument>): InvoiceDto {
  return {
    id: invoice._id.toString(),
    restaurantId: invoice.restaurantId.toString(),
    orderId: invoice.orderId.toString(),
    invoiceNumber: invoice.invoiceNumber,
    items: invoice.items.map((item) => ({
      menuItemId: item.menuItemId.toString(),
      nameSnapshot: item.nameSnapshot,
      priceSnapshot: item.priceSnapshot,
      qty: item.qty,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount
      ? {
          type: invoice.discount.type,
          value: invoice.discount.value,
          amountApplied: invoice.discount.amountApplied,
          approvedByStaffId: invoice.discount.approvedByStaffId?.toString(),
        }
      : undefined,
    taxLines: invoice.taxLines.map((tax) => ({
      name: tax.name,
      ratePercent: tax.ratePercent,
      amount: tax.amount,
    })),
    total: invoice.total,
    status: invoice.status,
    voidReason: invoice.voidReason,
    voidedByStaffId: invoice.voidedByStaffId?.toString(),
    createdByStaffId: invoice.createdByStaffId.toString(),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export async function findInvoiceOrThrow(
  restaurantId: string,
  invoiceId: string,
): Promise<HydratedDocument<InvoiceDocument>> {
  if (!Types.ObjectId.isValid(invoiceId)) {
    throw new AppError("Invoice not found.", 404, "NOT_FOUND");
  }
  const invoice = await Invoice.findOne({ _id: invoiceId, restaurantId });
  if (!invoice) {
    throw new AppError("Invoice not found.", 404, "NOT_FOUND");
  }
  return invoice;
}

/**
 * Integer-paise amount actually taken off the subtotal. Percent discounts
 * round to the nearest paise; flat discounts are clamped to the subtotal so
 * a mistakenly-large flat discount can never push the bill negative.
 */
function computeDiscountAmount(subtotal: number, discount: DiscountInput): number {
  if (discount.type === "percent") {
    return Math.round((subtotal * discount.value) / 100);
  }
  return Math.min(discount.value, subtotal);
}

/**
 * Compares the discount actually being applied against the restaurant's
 * configured threshold. Judgment call: whichever unit the threshold is
 * configured in is the unit the comparison happens in — a "15% threshold"
 * compares the discount's *effective* percent-of-subtotal (so a flat
 * discount that happens to equal 20% of a small bill still trips a 15%
 * threshold), while a "paise threshold" compares the applied paise amount
 * directly. This keeps the rule intuitive regardless of which discount
 * type the cashier chooses at the till.
 */
function discountExceedsThreshold(
  subtotal: number,
  amountApplied: number,
  threshold: RestaurantDocument["settings"]["discountApprovalThreshold"],
): boolean {
  if (threshold.type === "percent") {
    if (subtotal <= 0) return false;
    const effectivePercent = (amountApplied / subtotal) * 100;
    return effectivePercent > threshold.value;
  }
  return amountApplied > threshold.value;
}

/**
 * Verifies a manager/owner's email + password server-side and returns their
 * staff id. Reuses `comparePassword` (bcrypt) from `utils/password.ts` —
 * the same primitive `auth.service.ts` uses — instead of re-implementing
 * hashing/comparison here.
 *
 * Design note: approval intentionally accepts email + password only, not a
 * PIN. `auth.service.ts` already blocks PIN login for any account with 2FA
 * enabled, and PRD §3.1 makes 2FA mandatory for Owner/Admin/Manager — the
 * exact roles allowed to approve — so a PIN path would be unusable for a
 * compliant manager account in practice.
 */
async function verifyManagerApproval(
  restaurantId: string,
  email: string | undefined,
  password: string | undefined,
): Promise<Types.ObjectId> {
  if (!email || !password) {
    throw new AppError(
      "This discount needs manager approval. Ask a manager to confirm.",
      400,
      "DISCOUNT_APPROVAL_REQUIRED",
    );
  }

  const approver = await User.findOne({
    restaurantId,
    email: email.toLowerCase(),
  }).select("+passwordHash");

  if (!approver || !approver.isActive || !["owner", "manager"].includes(approver.role)) {
    throw new AppError(
      "Incorrect email or password for approval.",
      401,
      "DISCOUNT_APPROVAL_INVALID",
    );
  }

  const matches = await comparePassword(password, approver.passwordHash);
  if (!matches) {
    throw new AppError(
      "Incorrect email or password for approval.",
      401,
      "DISCOUNT_APPROVAL_INVALID",
    );
  }

  return approver._id;
}

/**
 * Generates the bill for a served order (PRD §3.10). Order must be
 * `served`; on success the order moves to `billed` (settlement/payment is a
 * separate step in `payment.service.ts`). Tax lines are computed from
 * `Restaurant.taxConfig` against the post-discount subtotal, supporting any
 * number of slabs (e.g. CGST + SGST both applied to the same base).
 */
export async function generateInvoice(
  restaurantId: string,
  staffId: string,
  orderId: string,
  input: GenerateInvoiceInput,
): Promise<InvoiceDto> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Order not found.", 404, "NOT_FOUND");
  }
  const order = await Order.findOne({ _id: orderId, restaurantId });
  if (!order) {
    throw new AppError("Order not found.", 404, "NOT_FOUND");
  }
  if (order.status !== "served") {
    throw new AppError("Only served orders can be billed.", 400, "ORDER_NOT_SERVED");
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  }

  const items = order.items.map((item) => ({
    menuItemId: item.menuItemId,
    nameSnapshot: item.nameSnapshot,
    priceSnapshot: item.priceSnapshot,
    qty: item.qty,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);

  let discount:
    | {
        type: DiscountType;
        value: number;
        amountApplied: number;
        approvedByStaffId?: Types.ObjectId;
      }
    | undefined;

  if (input.discount) {
    const amountApplied = computeDiscountAmount(subtotal, input.discount);
    let approvedByStaffId: Types.ObjectId | undefined;

    if (discountExceedsThreshold(subtotal, amountApplied, restaurant.settings.discountApprovalThreshold)) {
      approvedByStaffId = await verifyManagerApproval(
        restaurantId,
        input.approverEmail,
        input.approverPassword,
      );
    }

    discount = {
      type: input.discount.type,
      value: input.discount.value,
      amountApplied,
      approvedByStaffId,
    };
  }

  const postDiscountSubtotal = subtotal - (discount?.amountApplied ?? 0);
  const taxLines = restaurant.taxConfig.map((tax) => ({
    name: tax.name,
    ratePercent: tax.ratePercent,
    amount: Math.round((postDiscountSubtotal * tax.ratePercent) / 100),
  }));
  const total = postDiscountSubtotal + taxLines.reduce((sum, tax) => sum + tax.amount, 0);

  const invoiceNumber = await getNextSequence(restaurantId, "invoice");

  const invoice = await Invoice.create({
    restaurantId,
    orderId: order._id,
    invoiceNumber,
    items,
    subtotal,
    discount,
    taxLines,
    total,
    status: "issued",
    createdByStaffId: staffId,
  });

  order.status = "billed";
  await order.save();

  if (discount) {
    await recordAuditLog({
      restaurantId: order.restaurantId,
      staffId: new Types.ObjectId(staffId),
      action: "invoice.discount_applied",
      entityType: "Invoice",
      entityId: invoice._id.toString(),
      beforeValue: { subtotal },
      afterValue: { discount: toInvoiceDto(invoice).discount },
    });
  }

  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });

  return toInvoiceDto(invoice);
}

/**
 * Looks up the invoice already issued for an order, if any. Lets the
 * frontend resume mid-settlement after a reload between "Generate Bill"
 * and "Settle Bill" instead of erroring — the invoice was always created
 * server-side, the UI just had no way to fetch it back by order id.
 */
export async function findInvoiceByOrder(
  restaurantId: string,
  orderId: string,
): Promise<InvoiceDto | null> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Order not found.", 404, "NOT_FOUND");
  }
  const invoice = await Invoice.findOne({ restaurantId, orderId }).sort({ createdAt: -1 });
  return invoice ? toInvoiceDto(invoice) : null;
}

export async function getInvoiceDetail(
  restaurantId: string,
  invoiceId: string,
): Promise<{ invoice: InvoiceDto; payments: PaymentDto[] }> {
  const invoice = await findInvoiceOrThrow(restaurantId, invoiceId);
  const payments = await Payment.find({ restaurantId, invoiceId: invoice._id }).sort({
    createdAt: 1,
  });
  return { invoice: toInvoiceDto(invoice), payments: payments.map(toPaymentDto) };
}

export async function getInvoiceForPdf(
  restaurantId: string,
  invoiceId: string,
): Promise<{ invoice: InvoiceDto; restaurant: RestaurantDocument; payments: PaymentDto[] }> {
  const invoice = await findInvoiceOrThrow(restaurantId, invoiceId);
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  }
  const payments = await Payment.find({ restaurantId, invoiceId: invoice._id }).sort({
    createdAt: 1,
  });
  return { invoice: toInvoiceDto(invoice), restaurant, payments: payments.map(toPaymentDto) };
}

/**
 * Voids an issued invoice (PRD §3.10, Owner/Manager only at the route
 * level), fully audit-logged with before/after state.
 *
 * Design decision (documented per the task brief): whether voiding reopens
 * the order depends on whether payment was already collected.
 * - If the order is still `billed` (invoice issued, no `Payment` recorded
 *   yet — the common case: cashier caught a mistake before the guest paid),
 *   voiding reverts the order to `served` so a corrected invoice can be
 *   generated against the same order.
 * - If the order has already reached `closed` (payment was recorded), this
 *   endpoint does NOT reopen the order or change the table's status —
 *   money has already changed hands, and silently un-doing "table served
 *   and paid" state risks double-billing or losing the fact that the table
 *   turned over. Voiding in this state is treated as a post-payment
 *   void/refund *record* for audit purposes; it marks the invoice void and
 *   logs it, but does not itself reverse the `Payment` documents or the
 *   cash drawer. A dedicated refund-processing flow that also
 *   reverses/flags `Payment` records would be a sensible follow-up, out of
 *   scope for this MVP endpoint.
 */
export async function voidInvoice(
  restaurantId: string,
  staffId: string,
  invoiceId: string,
  reason: string,
): Promise<InvoiceDto> {
  const invoice = await findInvoiceOrThrow(restaurantId, invoiceId);

  if (invoice.status === "void") {
    throw new AppError("This invoice has already been voided.", 400, "INVOICE_ALREADY_VOID");
  }

  const beforeValue = {
    status: invoice.status,
    total: invoice.total,
  };

  invoice.status = "void";
  invoice.voidReason = reason;
  invoice.voidedByStaffId = new Types.ObjectId(staffId);
  await invoice.save();

  await recordAuditLog({
    restaurantId: invoice.restaurantId,
    staffId: new Types.ObjectId(staffId),
    action: "invoice.void",
    entityType: "Invoice",
    entityId: invoice._id.toString(),
    beforeValue,
    afterValue: { status: "void", reason },
  });

  const order = await Order.findOne({ _id: invoice.orderId, restaurantId });
  if (order && order.status === "billed") {
    order.status = "served";
    await order.save();
    emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });
  }
  // else: order already `closed` (paid) — see design note above, table
  // status is intentionally left untouched.

  return toInvoiceDto(invoice);
}
