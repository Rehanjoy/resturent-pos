/**
 * Hand-rolled line-icon set for the Phase 5 visual redesign. Deliberately
 * not a new dependency (e.g. lucide-react) — the nav rail, top bar, and
 * chart cards only need ~14 fixed icons, and inlining them as plain SVG
 * keeps the bundle small and gives full control over stroke weight to
 * match the brand kit's flat, single-color mark language (see
 * `docs/02-brand-kit.md` §3). Every icon takes the same `IconProps` shape
 * so callers can size/color them purely with Tailwind classes
 * (`className="h-5 w-5 text-sidebar-muted"` etc.) — color always comes
 * from `currentColor`, never a hardcoded fill.
 */
export interface IconProps {
  className?: string;
}

const BASE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </svg>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="2.5" y="6" width="19" height="4.5" rx="1.25" />
      <path d="M5 10.5v7.5M19 10.5v7.5" />
    </svg>
  );
}

export function OrdersIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5l-2-1.5V3.5Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function KitchenIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 3c1.8 2 2.4 3.7 1.4 5.1-.6.9-.3 1.7.4 2 1.4.6 2.7-.4 2.7-2 1.6 1.7 2 4.6.6 6.6a6 6 0 0 1-10.2 0c-1.6-2.3-1-5.6 1.2-7.2-.1 1.3.6 2.1 1.6 1.7.9-.3 1-1.2.5-2.1C9.1 5.9 10.1 4.3 12 3Z" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function MenuBookIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5Z" />
      <path d="M12 6v13" />
    </svg>
  );
}

export function ReportsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2.5 20.5h19" />
    </svg>
  );
}

export function StaffIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="8.5" r="2.25" />
      <path d="M15.8 14.7c2.3.2 4.2 2 4.2 4.8" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3" />
      <path d="M14 8.5 18 12l-4 3.5M18 12H9" />
    </svg>
  );
}

export function TrendUpIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="m4 16 5.5-6 4 3.5L20 6" />
      <path d="M15 6h5v5" />
    </svg>
  );
}

export function TrendDownIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="m4 8 5.5 6 4-3.5L20 18" />
      <path d="M15 18h5v-5" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </svg>
  );
}

export function PercentIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 18 18 6" />
      <circle cx="7.5" cy="7.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </svg>
  );
}

export function ChairIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 4h12v8H6z" />
      <path d="M6 12v8M18 12v8M6 20h12" />
    </svg>
  );
}

export function BroomIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M20 4 10 14" />
      <path d="M10 14 4 20l2-6 4-4 3 3-3 1Z" />
      <path d="M4 20l1.5-4.5" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.5 2.3 2.3L16 9.5" />
    </svg>
  );
}
