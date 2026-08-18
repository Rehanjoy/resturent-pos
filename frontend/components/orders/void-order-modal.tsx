"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * Reason-required void flow (PRD §3.3/§3.10 mandatory audit reason).
 * Route-guarded to Owner/Manager on the backend; the frontend also hides
 * the trigger button from other roles (`order-workspace.tsx`).
 */
export function VoidOrderModal({
  onClose,
  onConfirm,
  isSubmitting,
  errorMessage,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal title="Void Order" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason.trim());
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-small text-text-muted">
          This cancels the whole order and frees the table. A reason is required for the audit log.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            maxLength={300}
            placeholder="e.g. guest walked out, wrong table"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="rounded-md bg-error px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Voiding…" : "Void Order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
