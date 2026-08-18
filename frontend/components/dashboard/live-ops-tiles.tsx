import Link from "next/link";
import type { LiveOps } from "@/lib/dashboard/types";
import {
  ChairIcon,
  CheckCircleIcon,
  KitchenIcon,
  BroomIcon,
  AlertTriangleIcon,
  type IconProps,
} from "@/components/icons";

const TONE_CHIP = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
} as const;

/** Live operations widget (PRD §3.2) — deliberately not behind any cache,
 * unlike the top-dishes widget, since a stale table/kitchen count would
 * contradict "live". Each tile links to the screen that owns that state.
 * Includes the "Low-stock inventory alerts widget" (also PRD §3.2) as a
 * fifth tile now that the Inventory module exists. `canViewInventory`
 * controls whether that tile is a link — Cashier can see this dashboard
 * (PRD §2 Dashboard "View") but has no Inventory access at all (PRD §2
 * Inventory "—"), so for that role the tile renders as a plain, non-
 * clickable stat rather than linking to a screen that would immediately
 * deny access. */
export function LiveOpsTiles({
  liveOps,
  lowStockCount,
  canViewInventory,
}: {
  liveOps: LiveOps;
  lowStockCount: number;
  canViewInventory: boolean;
}) {
  const tiles: {
    href: string | null;
    label: string;
    value: number;
    tone: keyof typeof TONE_CHIP;
    icon: (props: IconProps) => React.ReactElement;
  }[] = [
    {
      href: "/admin/tables",
      label: "Tables Occupied",
      value: liveOps.tables.occupied,
      tone: "primary",
      icon: ChairIcon,
    },
    {
      href: "/admin/kitchen",
      label: "Orders In Kitchen",
      value: liveOps.ordersInKitchen,
      tone: "warning",
      icon: KitchenIcon,
    },
    {
      href: "/admin/kitchen",
      label: "Ready To Serve",
      value: liveOps.ordersReadyToServe,
      tone: "success",
      icon: CheckCircleIcon,
    },
    {
      href: "/admin/tables",
      label: "Needs Cleaning",
      value: liveOps.tables.needs_cleaning,
      tone: "error",
      icon: BroomIcon,
    },
    {
      href: canViewInventory ? "/admin/inventory" : null,
      label: "Low on Stock",
      value: lowStockCount,
      tone: lowStockCount > 0 ? "error" : "success",
      icon: AlertTriangleIcon,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const content = (
          <>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tile.tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-h3 font-semibold text-text">{tile.value}</p>
              <p className="truncate text-small text-text-muted">{tile.label}</p>
            </div>
          </>
        );
        const className =
          "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary";

        return tile.href ? (
          <Link key={tile.label} href={tile.href} className={className}>
            {content}
          </Link>
        ) : (
          <div key={tile.label} className={className.replace("hover:border-primary", "")}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
