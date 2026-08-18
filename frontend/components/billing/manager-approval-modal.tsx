"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * Server-verified discount-approval gate (PRD §3.10 "manager-approval lock
 * for discounts above a configurable threshold"). Only ever shown after the
 * backend has already rejected a discount for exceeding
 * `restaurant.settings.discountApprovalThreshold` with code
 * `DISCOUNT_APPROVAL_REQUIRED` — this is not a client-side bypass, it just
 * collects the credentials the backend will actually verify (bcrypt compare
 * against the manager/owner's real password) before retrying.
 */
export function ManagerApprovalModal({
  onClose,
  onConfirm,
  isSubmitting,
  errorMessage,
}: {
  onClose: () => void;
  onConfirm: (approverEmail: string, approverPassword: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Modal title="Manager Approval Needed" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(email.trim(), password);
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-small text-text-muted">
          This discount needs manager approval. Ask a manager to confirm.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Manager email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="off"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Manager password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="off"
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
            disabled={isSubmitting || !email.trim() || !password}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Confirming…" : "Confirm Discount"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
