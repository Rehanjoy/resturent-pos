import Link from "next/link";
import type { LiveOps } from "@/lib/dashboard/types";

/** Live operations widget (PRD §3.2) — deliberately not behind any cache,
 * unlike the top-dishes widget, since a stale table/kitchen count would
 * contradict "live". Each tile links to the screen that owns that state. */
export function LiveOpsTiles({ liveOps }: { liveOps: LiveOps }) {
  const tiles = [
    {
      href: "/admin/tables",
      label: "Tables Occupied",
      value: liveOps.tables.occupied,
    },
    {
      href: "/admin/kitchen",
      label: "Orders In Kitchen",
      value: liveOps.ordersInKitchen,
    },
    {
      href: "/admin/kitchen",
      label: "Ready To Serve",
      value: liveOps.ordersReadyToServe,
    },
    {
      href: "/admin/tables",
      label: "Needs Cleaning",
      value: liveOps.tables.needs_cleaning,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:border-primary"
        >
          <span className="font-heading text-h2 font-semibold text-primary">{tile.value}</span>
          <span className="text-small text-text-muted">{tile.label}</span>
        </Link>
      ))}
    </div>
  );
}
