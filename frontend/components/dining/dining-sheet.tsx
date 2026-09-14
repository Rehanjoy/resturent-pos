"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Mobile bottom sheet / desktop dialog with keyboard focus containment. */
export function DiningSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]');
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }}
      className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 pb-8 shadow-xl outline-none sm:rounded-3xl sm:p-6">
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="font-heading text-xl font-semibold">{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-xl">×</button></div>
      {children}
    </div>
  </div>;
}
