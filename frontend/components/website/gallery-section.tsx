"use client";

import { useState } from "react";
import { PlusIcon, TrashIcon } from "@/components/icons";

const MAX_GALLERY_IMAGES = 20;

/**
 * Gallery — list of image URLs with add/remove (PRD §3.13). "Add" posts a
 * single URL to `POST /api/website/media` (the deferred-upload stand-in,
 * see `backend/src/services/website.service.ts` `addGalleryImage`);
 * "remove" sends the filtered array through the same `PATCH
 * /api/website/content` the other sections use.
 */
export function GallerySection({
  galleryImageUrls,
  canEdit,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
  errorMessage,
}: {
  galleryImageUrls: string[];
  canEdit: boolean;
  onAdd: (imageUrl: string) => void;
  onRemove: (imageUrl: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
  errorMessage: string | null;
}) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const atCap = galleryImageUrls.length >= MAX_GALLERY_IMAGES;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Gallery</h2>
      {!canEdit && (
        <p className="mt-1 text-small text-text-muted">
          View only — ask an Owner to change gallery images.
        </p>
      )}

      {galleryImageUrls.length === 0 ? (
        <p className="mt-4 text-small text-text-muted">No gallery images yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {galleryImageUrls.map((url) => (
            <div key={url} className="relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-24 w-full object-cover" />
              {/* Always visible (not hover-only) — the Website Builder is
                  used from tablets too (Owner/Manager have no guaranteed
                  hover state there), so an `opacity-0 group-hover` reveal
                  would make this button unreachable on touch. */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  disabled={isRemoving}
                  aria-label="Remove image"
                  title="Remove image"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-60"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!newImageUrl.trim() || atCap) return;
            onAdd(newImageUrl.trim());
            setNewImageUrl("");
          }}
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-small font-medium text-text">Image URL</span>
            <input
              value={newImageUrl}
              onChange={(event) => setNewImageUrl(event.target.value)}
              disabled={atCap}
              placeholder="https://…"
              className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <button
            type="submit"
            disabled={isAdding || atCap || !newImageUrl.trim()}
            title={atCap ? `Gallery can hold at most ${MAX_GALLERY_IMAGES} images.` : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            <PlusIcon className="h-4 w-4" />
            {isAdding ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {canEdit && (
        <p className="mt-2 text-small text-text-muted">
          {galleryImageUrls.length}/{MAX_GALLERY_IMAGES} images. Direct upload isn&apos;t built yet
          (needs S3/cloud storage wiring, deferred like the Menu module&apos;s dish photos) — paste a
          hosted image URL for now.
        </p>
      )}

      {errorMessage && <p className="mt-2 text-small text-error">{errorMessage}</p>}
    </section>
  );
}
