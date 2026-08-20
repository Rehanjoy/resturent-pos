import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { parseCsv } from "../utils/csv";
import { isValidE164Phone } from "../utils/phone";
import { Contact, type ContactDocument, type ContactSource } from "../models/contact.model";

export interface ContactDto {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source: ContactSource;
  optedIn: boolean;
  notes?: string;
  createdByStaffId?: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(doc: HydratedDocument<ContactDocument>): ContactDto {
  return {
    id: doc._id.toString(),
    restaurantId: doc.restaurantId.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    tags: doc.tags,
    source: doc.source,
    optedIn: doc.optedIn,
    notes: doc.notes,
    createdByStaffId: doc.createdByStaffId?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface ListContactsFilters {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
}

export async function listContacts(
  restaurantId: string,
  filters: ListContactsFilters = {},
): Promise<{ contacts: ContactDto[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { restaurantId };
  if (filters.tag) query.tags = filters.tag;
  if (filters.search) {
    // Escape regex metacharacters in free-text search input — never build a
    // regex directly from unescaped user input (same convention as
    // `inventory-item.service.ts` `listInventoryItems`).
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
    ];
  }

  const [contacts, total] = await Promise.all([
    Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Contact.countDocuments(query),
  ]);

  return {
    contacts: contacts.map(toDto),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function assertPhoneAvailable(
  restaurantId: string,
  phone: string,
  excludeId?: string,
): Promise<void> {
  const existing = await Contact.findOne({
    restaurantId,
    phone,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new AppError(
      "A contact with this phone number already exists.",
      409,
      "DUPLICATE_CONTACT_PHONE",
    );
  }
}

export async function findContactOrThrow(
  restaurantId: string,
  contactId: string,
): Promise<HydratedDocument<ContactDocument>> {
  if (!Types.ObjectId.isValid(contactId)) {
    throw new AppError("Contact not found.", 404, "NOT_FOUND");
  }
  const contact = await Contact.findOne({ _id: contactId, restaurantId });
  if (!contact) {
    throw new AppError("Contact not found.", 404, "NOT_FOUND");
  }
  return contact;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

/**
 * Manual add (PRD-equivalent Part 1 scope: "manual add + CSV import").
 * `source` is always `"manual"` here — never accepted from the client, so a
 * caller can't spoof `csv_import`/`reservation`/`order` provenance.
 */
export async function createContact(
  restaurantId: string,
  staffId: string,
  input: CreateContactInput,
): Promise<ContactDto> {
  await assertPhoneAvailable(restaurantId, input.phone);

  const contact = await Contact.create({
    restaurantId,
    name: input.name,
    phone: input.phone,
    email: input.email || undefined,
    tags: input.tags ?? [],
    source: "manual",
    optedIn: true,
    notes: input.notes || undefined,
    createdByStaffId: staffId,
  });
  return toDto(contact);
}

export interface UpdateContactInput {
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  optedIn?: boolean;
}

export async function updateContact(
  restaurantId: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<ContactDto> {
  const contact = await findContactOrThrow(restaurantId, contactId);

  if (input.phone !== undefined && input.phone !== contact.phone) {
    await assertPhoneAvailable(restaurantId, input.phone, contactId);
    contact.phone = input.phone;
  }
  if (input.name !== undefined) contact.name = input.name;
  if (input.email !== undefined) contact.email = input.email || undefined;
  if (input.tags !== undefined) contact.tags = input.tags;
  if (input.notes !== undefined) contact.notes = input.notes || undefined;
  if (input.optedIn !== undefined) contact.optedIn = input.optedIn;

  await contact.save();
  return toDto(contact);
}

export async function deleteContact(restaurantId: string, contactId: string): Promise<void> {
  const contact = await findContactOrThrow(restaurantId, contactId);
  await contact.deleteOne();
}

export interface ImportContactsRowRejection {
  row: number;
  reason: string;
}

export interface ImportContactsResult {
  imported: number;
  updated: number;
  rejected: ImportContactsRowRejection[];
}

/** Tags within a CSV cell are semicolon-separated, not comma-separated —
 * the file's own column delimiter is a comma, so allowing commas inside an
 * unquoted tags cell too would make every multi-tag row ambiguous.
 * Documented for the admin in the Contacts screen's import modal copy
 * too (`frontend/components/marketing/import-contacts-modal.tsx`). */
function parseTagsCell(cell: string): string[] {
  return cell
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * CSV import (PRD-equivalent Part 1 scope). Expects `name,phone,email,tags`
 * columns (header row required, case-insensitive, any column order;
 * `email`/`tags` optional). Every row is find-or-created by `phone` — an
 * existing contact's `tags` are merged (union), never overwritten, so
 * re-importing the same list repeatedly is safe. Malformed rows (missing
 * name, invalid E.164 phone) are reported in `rejected`, never silently
 * dropped, so the admin sees exactly what happened per row.
 */
export async function importContactsFromCsv(
  restaurantId: string,
  csvText: string,
): Promise<ImportContactsResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { imported: 0, updated: 0, rejected: [] };
  }

  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.indexOf("phone");
  const emailIdx = header.indexOf("email");
  const tagsIdx = header.indexOf("tags");

  if (nameIdx === -1 || phoneIdx === -1) {
    throw new AppError(
      'The CSV must have "name" and "phone" columns (optional "email" and "tags").',
      400,
      "INVALID_CSV_HEADER",
    );
  }

  let imported = 0;
  let updated = 0;
  const rejected: ImportContactsRowRejection[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]!;
    const rowNumber = i + 1; // 1-based, matching what a spreadsheet app would show (row 1 = header).

    const name = (cells[nameIdx] ?? "").trim();
    const phone = (cells[phoneIdx] ?? "").trim();
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? "").trim() : "";
    const tags = tagsIdx >= 0 ? parseTagsCell(cells[tagsIdx] ?? "") : [];

    if (!name) {
      rejected.push({ row: rowNumber, reason: "Name is required." });
      continue;
    }
    if (!phone || !isValidE164Phone(phone)) {
      rejected.push({
        row: rowNumber,
        reason: `"${phone || "(empty)"}" is not a valid E.164 phone number (e.g. +919876543210).`,
      });
      continue;
    }

    const existing = await Contact.findOne({ restaurantId, phone });
    if (existing) {
      existing.name = name;
      if (email) existing.email = email;
      existing.tags = Array.from(new Set([...existing.tags, ...tags]));
      await existing.save();
      updated += 1;
    } else {
      await Contact.create({
        restaurantId,
        name,
        phone,
        email: email || undefined,
        tags,
        source: "csv_import",
        optedIn: true,
      });
      imported += 1;
    }
  }

  return { imported, updated, rejected };
}
