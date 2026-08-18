"use client";

import { useState } from "react";
import type { WebsiteContent } from "@/lib/website/types";

/** About section (PRD §3.13 "about" copy). Same canEdit gating as
 * `HeroForm` — see `website-screen.tsx`. */
export function AboutForm({
  content,
  canEdit,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  content: WebsiteContent;
  canEdit: boolean;
  onSubmit: (aboutText: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [aboutText, setAboutText] = useState(content.aboutText ?? "");

  if (!canEdit) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-heading text-h3 font-semibold text-text">About</h2>
        <p className="mt-1 text-small text-text-muted">
          View only — ask an Owner to change the about text.
        </p>
        <p className="mt-4 whitespace-pre-wrap text-body text-text">
          {content.aboutText || "No about text set."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">About</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(aboutText.trim());
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">About text</span>
          <textarea
            value={aboutText}
            onChange={(event) => setAboutText(event.target.value)}
            maxLength={4000}
            rows={5}
            placeholder="Tell customers what makes this place worth visiting…"
            className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-small text-text-muted">{aboutText.length}/4000</span>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save About"}
          </button>
        </div>
      </form>
    </section>
  );
}
