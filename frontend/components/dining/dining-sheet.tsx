"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Mobile bottom sheet / desktop dialog, built on shadcn's Dialog (Radix
 * underneath) rather than the previous hand-rolled overlay. Radix's
 * `DialogContent` already gives us, for free, everything the old manual
 * implementation had to build by hand: a real focus trap, Escape-to-close,
 * body scroll lock, and correct `role="dialog"`/`aria-modal`/
 * `aria-labelledby` wiring. Same `{ title, onClose, children }` contract as
 * before, so every call site (`GuestCart`, `MenuCustomization`,
 * `OrderTracker`'s cancel sheet) is unaffected.
 */
export function DiningSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="top-auto bottom-0 left-1/2 grid max-h-[90dvh] w-full max-w-lg -translate-x-1/2 translate-y-0 gap-0 overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-8 shadow-xl outline-none data-open:slide-in-from-bottom-8 sm:top-1/2 sm:bottom-auto sm:max-h-[85dvh] sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:p-6"
      >
        <div aria-hidden="true" className="mx-auto -mt-1 mb-4 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <DialogHeader>
          <DialogTitle className="pr-10">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
