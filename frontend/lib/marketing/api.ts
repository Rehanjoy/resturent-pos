import { api } from "@/lib/api";
import type { Contact, ContactImportResult, WhatsappConfig } from "./types";

export interface SaveWhatsappConfigInput {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export type UpdateContactInput = Partial<CreateContactInput> & { optedIn?: boolean };

function buildQuery(params: ListContactsParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Marketing module admin API — WhatsApp connection config + Contacts (Part
 * 1 of 3; Part 2 will add campaigns/broadcast, Part 3 the AI auto-reply
 * inbox, both under this same `/api/marketing` prefix). Goes through the
 * shared `lib/api.ts` client like every other admin screen.
 */
export const marketingApi = {
  getWhatsappConfig: () =>
    api.get<{ config: WhatsappConfig | null }>("/api/marketing/whatsapp-config"),

  saveWhatsappConfig: (input: SaveWhatsappConfigInput) =>
    api.patch<{ config: WhatsappConfig }>("/api/marketing/whatsapp-config", input),

  listContacts: (params: ListContactsParams = {}) =>
    api.get<{ contacts: Contact[]; total: number; page: number; totalPages: number }>(
      `/api/marketing/contacts${buildQuery(params)}`,
    ),

  createContact: (input: CreateContactInput) =>
    api.post<{ contact: Contact }>("/api/marketing/contacts", input),

  updateContact: (id: string, input: UpdateContactInput) =>
    api.patch<{ contact: Contact }>(`/api/marketing/contacts/${id}`, input),

  deleteContact: (id: string) =>
    api.delete<{ message: string }>(`/api/marketing/contacts/${id}`),

  importContacts: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.postForm<ContactImportResult>("/api/marketing/contacts/import", formData);
  },
};
