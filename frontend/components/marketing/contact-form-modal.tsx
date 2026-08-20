"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import type { Contact } from "@/lib/marketing/types";

export interface ContactFormValues {
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  notes?: string;
  optedIn?: boolean;
}

/** Add/Edit contact modal — manual add (Part 1 scope: "manual add + CSV
 * import"). Phone must be E.164 (`+919876543210`); the `pattern` attribute
 * gives instant feedback, the backend re-validates regardless
 * (`contact.validators.ts` `e164PhoneSchema`). */
export function ContactFormModal({
  contact,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [tagsText, setTagsText] = useState(contact?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [optedIn, setOptedIn] = useState(contact?.optedIn ?? true);

  const phoneLooksValid = /^\+[1-9]\d{6,14}$/.test(phone.trim());

  return (
    <Modal title={contact ? "Edit Contact" : "Add Contact"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            tags: tagsText
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            notes: notes.trim() || undefined,
            ...(contact ? { optedIn } : {}),
          });
        }}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Asha Rao"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Phone (E.164)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            placeholder="+919876543210"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
          {phone.trim().length > 0 && !phoneLooksValid && (
            <span className="text-small text-error">
              Enter a valid phone number starting with + and country code.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Tags (comma-separated)</span>
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="vip, regular, weekend"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        {contact && (
          <div className="flex items-center gap-2">
            <ToggleSwitch checked={optedIn} onChange={setOptedIn} label="Opted in to WhatsApp messages" />
            <span className="text-small font-medium text-text">Opted in to WhatsApp messages</span>
          </div>
        )}

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !phoneLooksValid}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
