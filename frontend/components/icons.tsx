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

// Added for the Phase 5 Part 3 pass (Billing/Menu/Staff/Settings restyle) —
// same flat single-color, `currentColor`-stroke language as every icon
// above, just five more glyphs the reference screenshots call for
// (payment-method buttons on Settle Bill, row actions on Staff).
export function EditIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8L17.3 5.5a2 2 0 0 0-2.8 0L4 16v4Z" />
      <path d="M13 7.5 16.5 11" />
    </svg>
  );
}

export function PowerIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 3.5v7.5" />
      <path d="M6.7 6.7a7.25 7.25 0 1 0 10.6 0" />
    </svg>
  );
}

export function CashIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 9v0M18.5 15v0" strokeWidth="2.5" />
    </svg>
  );
}

export function CardIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 9.5h19" />
      <path d="M5.5 14.5h5" />
    </svg>
  );
}

export function UpiIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="7.5" y="2.5" width="9" height="19" rx="2" />
      <path d="M10 18.5h4" />
      <path d="m9.5 10 2.5-3.5L14.5 10" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V7" />
      <path d="M6.5 7 7.3 19.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.3 11v6M13.7 11v6" />
    </svg>
  );
}

// Added for the Inventory module (PRD §3.9) — same flat single-color,
// `currentColor`-stroke language as every icon above.
export function BoxIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z" />
      <path d="M3.5 8v9L12 21.5 20.5 17V8" />
      <path d="M12 12.5v9" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TruckIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M2.5 6.5h11v10h-11z" />
      <path d="M13.5 10h4l3 3v3.5h-7z" />
      <circle cx="6.5" cy="18" r="1.6" />
      <circle cx="16.5" cy="18" r="1.6" />
    </svg>
  );
}

// Added for the Reservations module (PRD §3.7) — same flat single-color,
// `currentColor`-stroke language as every icon above.
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M5.5 4h3l1.5 4-2 1.5a10 10 0 0 0 4.5 4.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 4 6.6 1.5 1.5 0 0 1 5.5 4Z" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="m9.5 5 7 7-7 7" />
    </svg>
  );
}

// Added for the Website Builder module (PRD §3.13) — same flat
// single-color, `currentColor`-stroke language as every icon above.
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.5 2.3 3.8 5.4 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.4-3.8-8.5S9.5 5.8 12 3.5Z" />
    </svg>
  );
}

// Added for the Phase 5 responsive pass — the off-canvas nav drawer's
// hamburger toggle in `components/layout/topbar.tsx` (see
// `components/layout/sidebar.tsx` for the drawer itself). Same flat
// single-color, `currentColor`-stroke language as every icon above.
export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 3.5 3.5L17.5 11 20 14" />
    </svg>
  );
}

// Added for the Marketing module (WhatsApp Business Cloud API — PRD §6
// "WhatsApp Business API"). A speech-bubble mark reads as "messaging" at a
// glance, which fits Part 1 (Setup/Contacts) as well as Part 2's broadcast
// campaigns and Part 3's inbox that will share this same nav entry. Same
// flat single-color, `currentColor`-stroke language as every icon above.
export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l3.5 4v-14L7 9H5.5A1.5 1.5 0 0 0 4 10.5Z" />
      <path d="M14 8.5c1.6 1 1.6 6 0 7" />
      <path d="M17 6c2.8 1.6 2.8 10.4 0 12" />
    </svg>
  );
}

// Added for the Marketing module's Inbox (Part 3 — AI auto-reply). A paper
// plane reads as "send a message" at a glance, used on the conversation
// detail screen's manual reply button. Same flat single-color,
// `currentColor`-stroke language as every icon above.
export function SendIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4.5 12 20 4.5l-5 15-4-6-6-1.5Z" />
      <path d="m11 13 3.5-3.5" />
    </svg>
  );
}

// Added for the Marketing module's Inbox (Part 3). A bot/robot mark reads
// as "the AI is handling this" at a glance — used to label bot-authored
// chat bubbles on the conversation detail screen. Same flat single-color,
// `currentColor`-stroke language as every icon above.
export function BotIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="4.5" y="8.5" width="15" height="10" rx="3" />
      <path d="M12 8.5V5.5" />
      <circle cx="12" cy="4" r="1.25" />
      <circle cx="9" cy="13.5" r="1.25" />
      <circle cx="15" cy="13.5" r="1.25" />
      <path d="M9.5 17h5" />
    </svg>
  );
}
