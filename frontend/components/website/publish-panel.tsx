"use client";

import { ToggleSwitch } from "@/components/ui/toggle-switch";

/**
 * Publish/Unpublish toggle with a clear live-link state (PRD §3.13). The
 * public URL always resolves via the restaurant's slug — see
 * `app/(website)/[slug]/page.tsx` for the routing decision. Uses the shared
 * `ToggleSwitch` (same on/off visual language as every other boolean
 * control in the app, e.g. the Menu module's availability toggle) rather
 * than the previous bespoke Publish/Unpublish button.
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
          <div className="flex items-center gap-2.5">
            <span className="text-small font-medium text-text-muted">
              {isSubmitting ? "Saving…" : isPublished ? "Published" : "Unpublished"}
            </span>
            <ToggleSwitch
              checked={isPublished}
              onChange={onToggle}
              disabled={isSubmitting}
              label={isPublished ? "Unpublish site" : "Publish site"}
            />
          </div>
        )}
      </div>

      {errorMessage && <p className="mt-3 text-small text-error">{errorMessage}</p>}
    </section>
  );
}
