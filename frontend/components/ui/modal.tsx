"use client";

/**
 * Minimal shared modal shell (Add/Edit forms across Tables, Areas,
 * Categories, and Menu items all use this). Keeps overlay/close/title
 * markup in one place instead of every feature form re-implementing it.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        // `max-h-[calc(100vh-2rem)]` + `overflow-y-auto` — without this a
        // tall form (e.g. the Menu module's dish form with its ingredient
        // rows) can exceed a short viewport (a phone in landscape, or a
        // small tablet) with no way to reach the fields/buttons below the
        // fold, since the overlay itself doesn't scroll. Every modal in the
        // app goes through this one shell, so the fix applies everywhere at
        // once.
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text"
          >
            &#x2715;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
