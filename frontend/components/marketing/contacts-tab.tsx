"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { marketingApi, type CreateContactInput } from "@/lib/marketing/api";
import type { Contact } from "@/lib/marketing/types";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { ContactTable } from "./contact-table";
import { ContactFormModal, type ContactFormValues } from "./contact-form-modal";
import { ImportContactsModal } from "./import-contacts-modal";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Contacts tab — manual add + CSV import (Part 1 scope). Both Owner and
 * Manager can fully manage contacts (unlike the Setup tab's WhatsApp
 * connection, which is Owner-only) — see `marketing-screen.tsx`'s role
 * gates.
 */
export function ContactsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const contactsQuery = useQuery({
    queryKey: ["marketing-contacts", page, searchInput],
    queryFn: () => marketingApi.listContacts({ page, limit: 25, search: searchInput || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateContactInput) => marketingApi.createContact(input),
    onSuccess: () => {
      setIsAddOpen(false);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] });
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add this contact.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ContactFormValues }) =>
      marketingApi.updateContact(id, values),
    onSuccess: () => {
      setEditingContact(null);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] });
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not save this contact.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingApi.deleteContact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] }),
  });

  const data = contactsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or phone…"
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-body text-text"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="rounded-lg border border-border px-3.5 py-2 text-button text-text-muted transition-colors hover:text-text"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-button text-white"
          >
            <PlusIcon className="h-4 w-4" /> Add Contact
          </button>
        </div>
      </div>

      {contactsQuery.isLoading && <p className="text-small text-text-muted">Loading contacts…</p>}

      {contactsQuery.isError && (
        <p className="text-small text-error">
          Could not load contacts — check your connection and try again.
        </p>
      )}

      {data && data.contacts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            {searchInput ? "No contacts match your search." : "No contacts yet — add one or import a CSV."}
          </p>
        </div>
      )}

      {data && data.contacts.length > 0 && (
        <>
          <ContactTable
            contacts={data.contacts}
            canManage
            onEdit={setEditingContact}
            onDelete={(contact) => {
              if (window.confirm(`Delete contact "${contact.name}"?`)) {
                deleteMutation.mutate(contact.id);
              }
            }}
          />

          {data.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-6 py-4 shadow-sm">
              <p className="text-small font-medium text-text-muted">
                Page <span className="font-bold text-text">{data.page}</span> of{" "}
                <span className="font-bold text-text">{data.totalPages}</span> · {data.total} contacts
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-small font-semibold text-text-muted shadow-sm transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isAddOpen && (
        <ContactFormModal
          contact={null}
          onClose={() => {
            setIsAddOpen(false);
            setFormError(null);
          }}
          onSubmit={(values) => createMutation.mutate(values)}
          isSubmitting={createMutation.isPending}
          errorMessage={formError}
        />
      )}

      {editingContact && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => {
            setEditingContact(null);
            setFormError(null);
          }}
          onSubmit={(values) => updateMutation.mutate({ id: editingContact.id, values })}
          isSubmitting={updateMutation.isPending}
          errorMessage={formError}
        />
      )}

      {isImportOpen && <ImportContactsModal onClose={() => setIsImportOpen(false)} />}
    </div>
  );
}
