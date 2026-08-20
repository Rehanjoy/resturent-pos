"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api";
import { marketingApi } from "@/lib/marketing/api";
import { filterContactsForAudience } from "@/lib/marketing/audience";
import type { AudienceSelector, MarketingCampaign } from "@/lib/marketing/types";
import { SearchIcon } from "@/components/icons";
import { TemplateBodyPreview } from "./template-body-preview";

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type AudienceType = AudienceSelector["type"];

// This screen's estimate reads contacts up to the backend's max page size —
// accurate for the "dozens to low hundreds" scale this module's build
// brief targets. A restaurant with more contacts than that sees an
// "at least" estimate (`previewIsCapped` below); the real count is always
// resolved server-side at send time (`MarketingCampaign.recipientCount`).
const CONTACTS_PREVIEW_LIMIT = 100;

/**
 * "New Campaign" flow: pick an approved template, fill in its body
 * variables, pick an audience (all / by tag / specific contacts), see an
 * estimated recipient count, then send. Sends synchronously — the
 * `createCampaign` mutation only resolves once the whole batch has been
 * attempted (`marketing-campaign.service.ts`), so `onCreated` always
 * receives an already-`completed`/`failed` campaign, never a
 * still-`sending` one.
 */
export function NewCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (campaign: MarketingCampaign) => void;
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["marketing-templates"],
    queryFn: () => marketingApi.listMessageTemplates().then((result) => result.templates),
  });
  const approvedTemplates = (templatesQuery.data ?? []).filter((t) => t.status === "approved");
  const selectedTemplate = approvedTemplates.find((t) => t.id === templateId) ?? null;

  const contactsQuery = useQuery({
    queryKey: ["marketing-campaign-audience-contacts"],
    queryFn: () => marketingApi.listContacts({ limit: CONTACTS_PREVIEW_LIMIT }),
  });
  const contactsData = contactsQuery.data?.contacts;
  const contacts = useMemo(() => contactsData ?? [], [contactsData]);
  const contactsTotal = contactsQuery.data?.total ?? 0;
  const previewIsCapped = contactsTotal > contacts.length;
  const availableTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((contact) => contact.tags))).sort(),
    [contacts],
  );

  const contactSearchQuery = useQuery({
    queryKey: ["marketing-campaign-audience-search", contactSearch],
    queryFn: () => marketingApi.listContacts({ search: contactSearch, limit: 25 }),
    enabled: audienceType === "contactIds" && contactSearch.trim().length > 0,
  });

  const audience: AudienceSelector =
    audienceType === "all"
      ? { type: "all" }
      : audienceType === "tags"
        ? { type: "tags", tags: selectedTags }
        : { type: "contactIds", contactIds: selectedContactIds };

  const previewCount =
    audienceType === "contactIds"
      ? selectedContactIds.length
      : filterContactsForAudience(contacts, audience as Extract<AudienceSelector, { type: "all" | "tags" }>)
          .length;

  const createMutation = useMutation({
    mutationFn: () =>
      marketingApi.createCampaign({
        name: name.trim(),
        templateId,
        audience,
        bodyParams: bodyParams.map((value) => value.trim()),
      }),
    onSuccess: (result) => onCreated(result.campaign),
    onError: (error) => setFormError(errorMessageOf(error, "Could not send this campaign.")),
  });

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const template = approvedTemplates.find((t) => t.id === id);
    setBodyParams(template ? Array(template.variableCount).fill("") : []);
    if (!name.trim() && template) setName(template.name);
  }

  const audienceIsValid =
    audienceType === "all" ||
    (audienceType === "tags" && selectedTags.length > 0) ||
    (audienceType === "contactIds" && selectedContactIds.length > 0);
  const bodyParamsFilled = bodyParams.every((value) => value.trim().length > 0);
  const isValid = !!name.trim() && !!templateId && bodyParamsFilled && audienceIsValid;

  return (
    <Modal title="New Campaign" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid || createMutation.isPending) return;
          createMutation.mutate();
        }}
        className="flex flex-col gap-5"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Campaign name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Weekend Offer Blast"
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-text">Template</span>
          {templatesQuery.isLoading && <p className="text-small text-text-muted">Loading templates…</p>}
          {templatesQuery.isSuccess && approvedTemplates.length === 0 && (
            <p className="text-small text-text-muted">
              No approved templates yet. Sync from the Templates tab once Meta approves one.
            </p>
          )}
          {approvedTemplates.length > 0 && (
            <select
              value={templateId}
              onChange={(event) => handleTemplateChange(event.target.value)}
              required
              className="rounded-md border border-border px-3 py-2 text-body text-text"
            >
              <option value="">Select a template…</option>
              {approvedTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.language})
                </option>
              ))}
            </select>
          )}
          {selectedTemplate && (
            <div className="rounded-lg border border-border bg-background p-3">
              <TemplateBodyPreview text={selectedTemplate.bodyText} />
            </div>
          )}
        </div>

        {selectedTemplate && selectedTemplate.variableCount > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-small font-medium text-text">Fill in the template values</span>
            {bodyParams.map((value, index) => (
              <input
                key={index}
                value={value}
                onChange={(event) =>
                  setBodyParams((prev) => prev.map((v, i) => (i === index ? event.target.value : v)))
                }
                required
                placeholder={`Value for {{${index + 1}}}`}
                className="rounded-md border border-border px-3 py-2 text-body text-text"
              />
            ))}
            <p className="text-small text-text-muted">The same value is sent to every recipient.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-text">Audience</span>
          <div className="flex gap-2">
            {(
              [
                { type: "all", label: "All contacts" },
                { type: "tags", label: "By tag" },
                { type: "contactIds", label: "Choose contacts" },
              ] as const
            ).map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => setAudienceType(option.type)}
                className={`rounded-lg border px-3 py-1.5 text-small font-medium transition-colors ${
                  audienceType === option.type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {audienceType === "tags" &&
            (availableTags.length === 0 ? (
              <p className="text-small text-text-muted">No tags found on your contacts yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((t) => t !== tag) : [...prev, tag],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-small transition-colors ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ))}

          {audienceType === "contactIds" && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search contacts by name or phone…"
                  className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-body text-text"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {(contactSearchQuery.data?.contacts ?? [])
                  .filter((contact) => contact.optedIn)
                  .map((contact) => {
                    const checked = selectedContactIds.includes(contact.id);
                    return (
                      <label
                        key={contact.id}
                        className="flex items-center gap-2 border-b border-border px-3 py-2 text-small last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedContactIds((prev) =>
                              checked ? prev.filter((id) => id !== contact.id) : [...prev, contact.id],
                            )
                          }
                        />
                        <span className="text-text">{contact.name}</span>
                        <span className="text-text-muted">{contact.phone}</span>
                      </label>
                    );
                  })}
                {contactSearch.trim() &&
                  contactSearchQuery.isSuccess &&
                  (contactSearchQuery.data?.contacts.length ?? 0) === 0 && (
                    <p className="px-3 py-2 text-small text-text-muted">No contacts match.</p>
                  )}
                {!contactSearch.trim() && (
                  <p className="px-3 py-2 text-small text-text-muted">
                    Search by name or phone to find contacts to add.
                  </p>
                )}
              </div>
              {selectedContactIds.length > 0 && (
                <p className="text-small text-text-muted">{selectedContactIds.length} contact(s) selected.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-background p-3">
          <p className="text-small text-text-muted">Estimated recipients (opted-in only)</p>
          <p className="font-heading text-h4 font-semibold text-text">
            {previewCount}
            {previewIsCapped && audienceType !== "contactIds" ? "+" : ""}
          </p>
          {previewIsCapped && audienceType !== "contactIds" && (
            <p className="text-small text-text-muted">
              Showing the first {contacts.length} of {contactsTotal} contacts — the exact count is resolved
              when you send.
            </p>
          )}
        </div>

        {formError && <p className="text-small text-error">{formError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !isValid}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {createMutation.isPending ? "Sending…" : "Send Campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
