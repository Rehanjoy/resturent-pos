"use client";

import { useState } from "react";
import type { WebsiteContent } from "@/lib/website/types";

export interface HeroFormValues {
  heroImageUrl: string;
  heroHeadline: string;
}

/**
 * Hero section (PRD §3.13 "hero banner image, description text"). Owner
 * edits image URL + headline; Manager sees the same values read-only — no
 * inputs, no save button — mirroring `menu-screen.tsx`'s `canManage`
 * pattern (see `website-screen.tsx`).
 */
export function HeroForm({
  content,
  canEdit,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  content: WebsiteContent;
  canEdit: boolean;
  onSubmit: (values: HeroFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [heroImageUrl, setHeroImageUrl] = useState(content.heroImageUrl ?? "");
  const [heroHeadline, setHeroHeadline] = useState(content.heroHeadline ?? "");

  if (!canEdit) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-heading text-h3 font-semibold text-text">Hero</h2>
        <p className="mt-1 text-small text-text-muted">
          View only — ask an Owner to change the hero section.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {content.heroImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={content.heroImageUrl}
              alt=""
              className="h-40 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <p className="text-small text-text-muted">No hero image set.</p>
          )}
          <p className="text-body text-text">{content.heroHeadline || "No headline set."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Hero</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ heroImageUrl: heroImageUrl.trim(), heroHeadline: heroHeadline.trim() });
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Hero image URL</span>
          <input
            value={heroImageUrl}
            onChange={(event) => setHeroImageUrl(event.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-small text-text-muted">
            Direct image upload isn&apos;t built yet (needs S3/cloud storage wiring, deferred like
            the Menu module&apos;s dish photos) — paste a hosted image URL for now.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Headline</span>
          <input
            value={heroHeadline}
            onChange={(event) => setHeroHeadline(event.target.value)}
            maxLength={160}
            placeholder="e.g. Real food, real fast"
            className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save Hero"}
          </button>
        </div>
      </form>
    </section>
  );
}
