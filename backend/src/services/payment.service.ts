import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Order } from "../models/order.model";
import type { OrderDto } from "./order.service";
import { Restaurant } from "../models/restaurant.model";
import { Payment, type PaymentDocument, type PaymentMode, PAYMENT_MODES } from "../models/payment.model";
import { findInvoiceOrThrow, toInvoiceDto, type InvoiceDto } from "./invoice.service";
import { toOrderDto } from "./order.service";
import * as tableService from "./table.service";
import { emitToRestaurant } from "../sockets";
import { recordVisitPayment } from "./customer.service";

export interface PaymentDto {
  id: string;
  restaurantId: string;
  invoiceId: string;
  mode: PaymentMode;
  amount: number;
  createdAt: Date;
}

export interface PaymentLineInput {
  mode: PaymentMode;
  amount: number;
}

export interface CreatePaymentInput {
  invoiceId: string;
  payments: PaymentLineInput[];
}

export function toPaymentDto(payment: HydratedDocument<PaymentDocument>): PaymentDto {
  return {
    id: payment._id.toString(),
    restaurantId: payment.restaurantId.toString(),
    invoiceId: payment.invoiceId.toString(),
    mode: payment.mode,
    amount: payment.amount,
    createdAt: payment.createdAt,
  };
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/**
 * Settles an issued invoice (PRD §3.10 "Payment mode recording ... Split-
 * payment across modes"). MVP scope is deliberately strict: the sum of the
 * submitted payment lines must equal `invoice.total` exactly — no partial
 * payments, no overpayment/change-due handling. On success the order moves
 * to `closed` and the table is handed to `table.service.ts` to flip to
 * `needs_cleaning`, reusing the one status-update path instead of writing a
 * second one here (per the task's explicit instruction).
 */
export async function createPayment(
  restaurantId: string,
  input: CreatePaymentInput,
): Promise<{ invoice: InvoiceDto; payments: PaymentDto[]; order: OrderDto }> {
  const invoice = await findInvoiceOrThrow(restaurantId, input.invoiceId);

  if (invoice.status !== "issued") {
    throw new AppError("This bill can no longer be paid.", 400, "INVOICE_NOT_PAYABLE");
  }

  const alreadyPaid = await Payment.exists({ restaurantId, invoiceId: invoice._id });
  if (alreadyPaid) {
    throw new AppError("This bill has already been paid.", 400, "INVOICE_ALREADY_PAID");
  }

  const submittedTotal = input.payments.reduce((sum, line) => sum + line.amount, 0);
  if (submittedTotal !== invoice.total) {
    throw new AppError(
      `Payment total must equal the bill total of ${formatRupees(invoice.total)}.`,
      400,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const restaurant = await Restaurant.findById(restaurantId);
  const enabledModes = restaurant?.settings.enabledPaymentModes ?? [...PAYMENT_MODES];
  for (const line of input.payments) {
    if (!enabledModes.includes(line.mode)) {
      throw new AppError(
        `${line.mode.toUpperCase()} is not an enabled payment method for this restaurant.`,
        400,
        "PAYMENT_MODE_DISABLED",
      );
    }
  }

  const created = await Payment.insertMany(
    input.payments.map((line) => ({
      restaurantId: new Types.ObjectId(restaurantId),
      invoiceId: invoice._id,
      mode: line.mode,
      amount: line.amount,
    })),
  );

  const order = await Order.findOne({ _id: invoice.orderId, restaurantId });
  if (!order) {
    throw new AppError("Order not found for this bill.", 404, "NOT_FOUND");
  }
  order.status = "closed";
  await order.save();
  // Analytics must never turn an already-recorded payment into a failed
  // checkout response. It remains recoverable from the payment ledger.
  await recordVisitPayment(restaurantId, order.id, invoice.id).catch(() => undefined);

  // Chair sessions remain occupied until staff explicitly release this party.
  if (!order.diningSessionId) await tableService.updateTableStatus(restaurantId, order.tableId.toString(), "needs_cleaning");

  const orderDto = toOrderDto(order);
  emitToRestaurant(restaurantId, "order:updated", { order: orderDto });

  return {
    invoice: toInvoiceDto(invoice),
    payments: created.map((doc) => toPaymentDto(doc)),
    order: orderDto,
  };
}
