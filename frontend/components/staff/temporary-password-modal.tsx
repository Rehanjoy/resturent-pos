"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * Shown exactly once, right after a staff account is created without an
 * initial password supplied. No email/SMS provider is wired up yet (see
 * the Settings module's out-of-scope note on notification preferences), so
 * this is the only place the generated password is ever surfaced — it's
 * never logged and the API never returns it again after this response.
 */
export function TemporaryPasswordModal({
  staffName,
  password,
  onClose,
}: {
  staffName: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal title="Temporary Password" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-text">
          {staffName}&apos;s account was created. Share this temporary password with them — they
          will be required to set a new one the first time they log in.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <code className="text-body font-medium tracking-wide text-text">{password}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(password).then(() => setCopied(true));
            }}
            className="rounded-md border border-border px-3 py-1.5 text-small text-text hover:bg-surface"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-small text-text-muted">
          This password won&apos;t be shown again after you close this window.
        </p>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 text-button text-white"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
