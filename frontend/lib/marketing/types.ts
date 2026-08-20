/** Mirrors `backend/src/services/whatsapp-config.service.ts`
 * `WhatsappConfigDto` — never carries the access token itself, encrypted
 * or otherwise (see the service's own doc comment on why). */
export interface WhatsappConfig {
  id: string;
  restaurantId: string;
  phoneNumberId: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isConnected: boolean;
  connectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactSource = "manual" | "csv_import" | "reservation" | "order";

/** Mirrors `backend/src/services/contact.service.ts` `ContactDto`. */
export interface Contact {
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
  createdAt: string;
  updatedAt: string;
}

export interface ContactImportRejection {
  row: number;
  reason: string;
}

/** Mirrors `backend/src/services/contact.service.ts` `ImportContactsResult`
 * — the per-row summary the Contacts screen shows after a CSV upload. */
export interface ContactImportResult {
  imported: number;
  updated: number;
  rejected: ContactImportRejection[];
}
