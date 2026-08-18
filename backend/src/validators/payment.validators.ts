import { z } from "zod";
import { PAYMENT_MODES } from "../models/payment.model";

export const paymentLineSchema = z.object({
  mode: z.enum(PAYMENT_MODES),
  amount: z.number().int("Amount must be a whole number of paise.").positive("Amount must be greater than zero."),
});

export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice id is required."),
  payments: z.array(paymentLineSchema).min(1, "At least one payment line is required."),
});
