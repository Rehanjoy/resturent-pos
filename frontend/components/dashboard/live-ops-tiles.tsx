import Link from "next/link";
import type { LiveOps } from "@/lib/dashboard/types";
import { ChairIcon, CheckCircleIcon, KitchenIcon, BroomIcon, type IconProps } from "@/components/icons";

const TONE_CHIP = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
} as const;

/** Live operations widget (PRD §3.2) — deliberately not behind any cache,
 * unlike the top-dishes widget, since a stale table/kitchen count would
 * contradict "live". Each tile links to the screen that owns that state. */
export function LiveOpsTiles({ liveOps }: { liveOps: LiveOps }) {
  const tiles: {
    href: string;
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
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.label}
            href={tile.href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tile.tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-h3 font-semibold text-text">{tile.value}</p>
              <p className="truncate text-small text-text-muted">{tile.label}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
