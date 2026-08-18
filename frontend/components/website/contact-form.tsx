"use client";

import { useState } from "react";
import type { WebsiteContent } from "@/lib/website/types";

export interface ContactFormValues {
  contactPhone: string;
  contactEmail: string;
  mapEmbedUrl: string;
}

/** Contact section (PRD §3.13 "location map, contact"). `mapEmbedUrl` is an
 * iframe embed link (e.g. Google Maps "Embed a map"), not a plain
 * address/lat-lng — rendered directly in an <iframe> on the public page. */
export function ContactForm({
  content,
  canEdit,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  content: WebsiteContent;
  canEdit: boolean;
  onSubmit: (values: ContactFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [contactPhone, setContactPhone] = useState(content.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(content.contactEmail ?? "");
  const [mapEmbedUrl, setMapEmbedUrl] = useState(content.mapEmbedUrl ?? "");

  if (!canEdit) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-heading text-h3 font-semibold text-text">Contact</h2>
        <p className="mt-1 text-small text-text-muted">
          View only — ask an Owner to change contact details.
        </p>
        <div className="mt-4 flex flex-col gap-1 text-body text-text">
          <p>Phone: {content.contactPhone || "Not set"}</p>
          <p>Email: {content.contactEmail || "Not set"}</p>
          <p>Map embed: {content.mapEmbedUrl ? "Set" : "Not set"}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Contact</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            contactPhone: contactPhone.trim(),
            contactEmail: contactEmail.trim(),
            mapEmbedUrl: mapEmbedUrl.trim(),
          });
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Phone</span>
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="+91 98765 43210"
              className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="hello@yourrestaurant.com"
              className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Map embed URL</span>
          <input
            value={mapEmbedUrl}
            onChange={(event) => setMapEmbedUrl(event.target.value)}
            placeholder="https://www.google.com/maps/embed?pb=…"
            className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-small text-text-muted">
            From Google Maps → Share → Embed a map → copy the iframe&apos;s <code>src</code> URL.
          </span>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save Contact"}
          </button>
        </div>
      </form>
    </section>
  );
}
