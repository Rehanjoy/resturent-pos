import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";
import * as contactService from "../services/contact.service";

export const listContacts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, tag } = req.query as unknown as {
    page: number;
    limit: number;
    search?: string;
    tag?: string;
  };
  const result = await contactService.listContacts(req.user!.restaurantId, { page, limit, search, tag });
  res.status(200).json(result);
});

export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactService.createContact(req.user!.restaurantId, req.user!.userId, req.body);
  res.status(201).json({ contact });
});

export const updateContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await contactService.updateContact(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ contact });
});

export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  await contactService.deleteContact(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Contact deleted." });
});

export const importContacts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError("A CSV file is required.", 400, "FILE_REQUIRED");
  }
  const result = await contactService.importContactsFromCsv(
    req.user!.restaurantId,
    req.file.buffer.toString("utf8"),
  );
  res.status(200).json(result);
});
