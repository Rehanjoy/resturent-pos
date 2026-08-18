import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as invoiceService from "../services/invoice.service";
import { streamInvoicePdf } from "../utils/invoice-pdf";

export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.generateInvoice(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.orderId),
    req.body,
  );
  res.status(201).json({ invoice });
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await invoiceService.getInvoiceDetail(req.user!.restaurantId, String(req.params.id));
  res.status(200).json(result);
});

export const getInvoiceByOrder = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.findInvoiceByOrder(
    req.user!.restaurantId,
    String(req.params.orderId),
  );
  res.status(200).json({ invoice });
});

export const getInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const { invoice, restaurant, payments } = await invoiceService.getInvoiceForPdf(
    req.user!.restaurantId,
    String(req.params.id),
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
  );
  streamInvoicePdf(res, { restaurant, invoice, payments });
});

export const voidInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.voidInvoice(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body.reason,
  );
  res.status(200).json({ invoice });
});
