"use client";

import { EditIcon, TrashIcon } from "@/components/icons";
import type { Contact, ContactSource } from "@/lib/marketing/types";

const SOURCE_BADGE: Record<ContactSource, { label: string; className: string }> = {
  manual: { label: "Manual", className: "border-border text-text-muted" },
  csv_import: { label: "CSV Import", className: "border-secondary text-secondary" },
  reservation: { label: "Reservation", className: "border-primary text-primary" },
  order: { label: "Order", className: "border-accent text-accent" },
};

/**
 * Dense table for the Contacts tab — same visual language as
 * `components/menu/dish-table.tsx` (the established table styling this
 * screen is asked to mirror): name/phone, tags, source badge, row actions.
 */
export function ContactTable({
  contacts,
  canManage,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  canManage: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Tags</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Opted in</th>
            {canManage && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const badge = SOURCE_BADGE[contact.source];
            return (
              <tr key={contact.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-small font-medium text-text-muted">
                      {contact.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{contact.name}</p>
                      {contact.email && (
                        <p className="truncate text-small text-text-muted">{contact.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-text">{contact.phone}</td>
                <td className="max-w-xs px-4 py-3">
                  {contact.tags.length === 0 ? (
                    <span className="text-small text-text-muted/60">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-small font-medium ${
                      contact.optedIn ? "bg-success/10 text-success" : "bg-error/10 text-error"
                    }`}
                  >
                    {contact.optedIn ? "Opted in" : "Opted out"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(contact)}
                        title={`Edit ${contact.name}`}
                        aria-label={`Edit ${contact.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(contact)}
                        title={`Delete ${contact.name}`}
                        aria-label={`Delete ${contact.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
