"use client";

/**
 * Shared on/off switch — extracted from what was `dish-table.tsx`'s
 * hand-rolled availability toggle (the only place in the app that already
 * matched the reference screenshots' switch language) during the Phase 5
 * responsive/polish pass, so every boolean control in the app now shares
 * one visual language instead of several slightly-different hand-rolled
 * versions: same track size (`h-6 w-11`), same thumb, same on/off colors
 * (`--color-success` for on, `--color-border` for off — semantic tokens
 * from `docs/02-brand-kit.md`, never a hardcoded hex), same
 * `transition-colors`/`transition-transform` timing already used
 * throughout the app.
 *
 * `label` is required (not optional) — every instance must announce what
 * it toggles to a screen reader via `aria-label`, since the control itself
 * carries no visible text.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-success" : "bg-border"
      } ${className}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
