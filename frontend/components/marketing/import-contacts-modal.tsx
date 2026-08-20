"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import type { ContactImportResult } from "@/lib/marketing/types";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * CSV import modal — file picker, then the `{imported, updated, rejected}`
 * summary shown clearly per row (not a generic success toast), so the
 * admin sees exactly what happened to every line of their file. Mirrors
 * `contact.service.ts` `importContactsFromCsv`'s response shape exactly.
 */
export function ImportContactsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (selectedFile: File) => marketingApi.importContacts(selectedFile),
    onSuccess: (data) => {
      setResult(data);
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] });
    },
    onError: (error) => setErrorMessage(errorMessageOf(error, "Could not import this file.")),
  });

  return (
    <Modal title="Import Contacts from CSV" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-small text-text-muted">
          Columns: <code className="rounded bg-background px-1 py-0.5">name</code>,{" "}
          <code className="rounded bg-background px-1 py-0.5">phone</code> (required, E.164 —{" "}
          e.g. +919876543210), <code className="rounded bg-background px-1 py-0.5">email</code>,{" "}
          <code className="rounded bg-background px-1 py-0.5">tags</code> (optional). Separate
          multiple tags with a semicolon, e.g. <code className="rounded bg-background px-1 py-0.5">vip;regular</code>.
          Re-importing an existing phone number updates that contact instead of duplicating it.
        </p>

        {!result && (
          <>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-lg border border-border px-3 py-2 text-body text-text file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-3 file:py-1.5 file:text-small file:font-medium file:text-text"
            />

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
                type="button"
                disabled={!file || importMutation.isPending}
                onClick={() => file && importMutation.mutate(file)}
                className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
              >
                {importMutation.isPending ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-success/10 p-3 text-center">
                <p className="text-h4 font-heading font-semibold text-success">{result.imported}</p>
                <p className="text-small text-text-muted">Imported</p>
              </div>
              <div className="rounded-xl bg-secondary/10 p-3 text-center">
                <p className="text-h4 font-heading font-semibold text-secondary">{result.updated}</p>
                <p className="text-small text-text-muted">Updated</p>
              </div>
              <div className="rounded-xl bg-error/10 p-3 text-center">
                <p className="text-h4 font-heading font-semibold text-error">{result.rejected.length}</p>
                <p className="text-small text-text-muted">Rejected</p>
              </div>
            </div>

            {result.rejected.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-left text-small">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rejected.map((entry) => (
                      <tr key={entry.row} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums text-text">{entry.row}</td>
                        <td className="px-3 py-2 text-error">{entry.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-accent px-4 py-2 text-button text-white"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
