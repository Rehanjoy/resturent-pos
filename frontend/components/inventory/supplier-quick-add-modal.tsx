"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/** Small "add a supplier without leaving the item form" modal — opened from
 * the supplier dropdown in `inventory-item-form-modal.tsx`. Deliberately
 * only exposes name/phone/email/notes (no dedicated supplier management
 * screen exists yet in this build); full edit lives on the backend
 * (`PATCH /api/inventory/suppliers/:id`) for a future pass. */
export function SupplierQuickAddModal({
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    contactPhone?: string;
    contactEmail?: string;
    notes?: string;
  }) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [name, setName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  return (
    <Modal title="Add Supplier" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name: name.trim(),
            contactPhone: contactPhone.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Supplier name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Fresh Farms Co."
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Contact phone</span>
          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="Optional"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="Optional"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

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
            disabled={isSubmitting || !name.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
