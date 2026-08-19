import type { OrderStatus } from "@/lib/orders/types";
import { AlertTriangleIcon } from "@/components/icons";

/**
 * The visible happy-path steps a staff member cares about, per the
 * client's own wording. Deliberately does NOT include "Draft" as a step —
 * it's a pre-order state (the cart is still being built, nothing has
 * happened yet), not part of the flow once the order has actually moved —
 * see `stepStatesFor` below, which returns `null` for `draft` so the
 * caller renders a lightweight "still building" line instead of the
 * stepper.
 */
const STEPS: { key: string; label: string }[] = [
  { key: "sent", label: "Sent to Kitchen" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready to Serve" },
  { key: "served", label: "Served" },
  { key: "billing", label: "Billing Required" },
  { key: "billed", label: "Billed" },
];

type StepState = "complete" | "current" | "upcoming";

/**
 * Maps the backend's `OrderStatus` (see `backend/src/services/
 * order.service.ts`) onto the 6 steps above. The backend has fewer
 * distinct statuses than the stepper has steps, so two mappings need
 * documenting:
 *
 * - `sent` vs `in_kitchen`: both are "the kitchen is cooking this" states
 *   — `sent` is set on the order's first KOT, `in_kitchen` when a later
 *   KOT is appended while it's still cooking (see `sendToKitchen` in
 *   `order.service.ts`). They map to steps 0 ("Sent to Kitchen") and 1
 *   ("Preparing") respectively.
 * - `served`: every item has reached the kitchen-side "served" state, but
 *   no bill has been generated yet. That single backend status covers two
 *   visual moments here — the "Served" step (index 3) is marked complete
 *   (the food is out), and "Billing Required" (index 4) is the *current*
 *   step, because that is this app's status of `served` once nothing has
 *   been billed yet — i.e. it's the next thing staff need to do.
 * - `billed` / `closed`: both mean an invoice exists (`closed` additionally
 *   means it has been paid/settled — see `payment.service.ts`). The
 *   client's 6-step list stops at "Billed" with no separate "paid" step,
 *   so both statuses render as the same fully-complete terminal state
 *   (every step checked, nothing left pending).
 * - `draft` and `void` never reach this function — the component handles
 *   them before calling it (draft = pre-flow, void = distinct terminal
 *   banner, not a position on the linear stepper).
 */
function stepStatesFor(status: OrderStatus): StepState[] | null {
  const upTo = (completeCount: number, currentIndex?: number): StepState[] =>
    STEPS.map((_, index) => {
      if (index === currentIndex) return "current";
      return index < completeCount ? "complete" : "upcoming";
    });

  switch (status) {
    case "sent":
      return upTo(0, 0);
    case "in_kitchen":
      return upTo(1, 1);
    case "ready":
      return upTo(2, 2);
    case "served":
      return upTo(4, 4);
    case "billed":
    case "closed":
      return upTo(STEPS.length);
    default:
      return null;
  }
}

function circleClasses(state: StepState): string {
  const base =
    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 sm:h-8 sm:w-8";
  if (state === "complete") return `${base} border-success bg-success text-white`;
  if (state === "current") return `${base} border-accent bg-accent text-white`;
  return `${base} border-border bg-surface text-text-muted`;
}

function labelClasses(state: StepState): string {
  if (state === "current") return "font-semibold text-text";
  if (state === "complete") return "text-text";
  return "text-text-muted";
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 12.5 4.2 4.2L18 8" />
    </svg>
  );
}

/**
 * Horizontal progress stepper for an order's lifecycle, replacing the old
 * plain "Status: X" subtitle text on `order-workspace.tsx`. Renders three
 * possible shapes depending on `status`:
 *  - `void` → a distinct "Voided" banner (with reason, if given) — void is
 *    a terminal off-ramp, not a position on the linear happy path.
 *  - `draft` → a muted single line — the order exists but nothing has
 *    happened yet, so there's no progress to visualize.
 *  - everything else → the 6-step progress stepper.
 *
 * Colors are exactly the brand kit's semantic tokens — no new colors:
 * completed = `--color-success`, current = `--color-accent`, upcoming =
 * muted border/text. `orderStatusTone` below derives the same tone
 * language for the compact per-row dot on `orders-overview.tsx`, so the
 * two views never disagree about what a given status means.
 *
 * Layout: a CSS grid with one equal-width column per step, connecting
 * lines rendered as flex-fill bars either side of each circle, and labels
 * below in a separate row so they can wrap to two lines on narrow widths
 * instead of forcing the stepper to overflow — verified down to a 360px
 * viewport (a wrapping label is fine on a POS tablet in portrait mode; an
 * overflowing/clipped stepper is not).
 */
export function OrderStatusStepper({
  status,
  voidReason,
  className,
}: {
  status: OrderStatus;
  voidReason?: string;
  className?: string;
}) {
  if (status === "void") {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border border-error bg-error/10 px-4 py-3 text-small font-medium text-error ${className ?? ""}`}
      >
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{voidReason ? `Voided — ${voidReason}` : "Voided"}</span>
      </div>
    );
  }

  const states = stepStatesFor(status);

  if (!states) {
    // `draft` (and any future non-flow status): nothing to visualize yet.
    return (
      <p className={`text-small text-text-muted ${className ?? ""}`}>
        Building order — add items and send to kitchen to start tracking progress.
      </p>
    );
  }

  return (
    <div className={`w-full overflow-x-auto ${className ?? ""}`}>
      <ol className="grid w-full grid-flow-col auto-cols-fr items-start">
        {STEPS.map((step, index) => {
          const state = states[index];
          const leftFilled = index > 0 && states[index - 1] === "complete";
          const rightFilled = state === "complete";
          return (
            <li key={step.key} className="flex flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 flex-1 ${index === 0 ? "invisible" : leftFilled ? "bg-success" : "bg-border"}`}
                />
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8">
                  {state === "current" && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-40" />
                  )}
                  <div className={circleClasses(state)}>
                    {state === "complete" ? (
                      <CheckMark className="h-4 w-4" />
                    ) : (
                      <span className="text-[11px] font-semibold">{index + 1}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`h-0.5 flex-1 ${index === STEPS.length - 1 ? "invisible" : rightFilled ? "bg-success" : "bg-border"}`}
                />
              </div>
              <span
                className={`px-0.5 text-center text-[11px] leading-tight sm:text-small ${labelClasses(state)}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type OrderStatusTone = "muted" | "current" | "success" | "error";

/**
 * Single source of truth for "what color represents this order's overall
 * status" — imported by `orders-overview.tsx`'s compact per-row status dot
 * so it never drifts from the colors used above. Same three-tone language
 * as the stepper (muted = not started, current = accent, success =
 * complete), plus `error` for the `void` off-ramp.
 */
export function orderStatusTone(status: OrderStatus): OrderStatusTone {
  switch (status) {
    case "draft":
      return "muted";
    case "sent":
    case "in_kitchen":
    case "ready":
    case "served":
      return "current";
    case "billed":
    case "closed":
      return "success";
    case "void":
      return "error";
    default:
      return "muted";
  }
}
