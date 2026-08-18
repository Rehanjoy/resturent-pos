"use client";

import { PowerIcon } from "@/components/icons";

/**
 * Publish/Unpublish toggle with a clear live-link state (PRD §3.13). The
 * public URL always resolves via the restaurant's slug — see
 * `app/(website)/[slug]/page.tsx` for the routing decision.
 */
export function PublishPanel({
  isPublished,
  publicUrl,
  canEdit,
  onToggle,
  isSubmitting,
  errorMessage,
}: {
  isPublished: boolean;
  publicUrl: string;
  canEdit: boolean;
  onToggle: (nextIsPublished: boolean) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-h3 font-semibold text-text">Publish</h2>
          {isPublished ? (
            <p className="mt-1 text-small text-success">
              Your site is live at{" "}
              <a href={publicUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                {publicUrl}
              </a>
            </p>
          ) : (
            <p className="mt-1 text-small text-text-muted">
              Not published yet — customers can&apos;t see this site until you publish it.
            </p>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => onToggle(!isPublished)}
            disabled={isSubmitting}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-button shadow-sm transition-colors disabled:opacity-60 ${
              isPublished
                ? "border border-border text-text-muted hover:text-text"
                : "bg-accent text-white hover:bg-primary"
            }`}
          >
            <PowerIcon className="h-4 w-4" />
            {isSubmitting ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
          </button>
        )}
      </div>

      {errorMessage && <p className="mt-3 text-small text-error">{errorMessage}</p>}
    </section>
  );
}
