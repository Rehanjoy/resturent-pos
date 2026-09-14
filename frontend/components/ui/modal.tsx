"use client";

import { useEffect, useRef, useId } from "react";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
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
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-8 shadow-xl outline-none sm:rounded-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-heading text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-text-muted hover:text-text"
          >
            &#x2715;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
