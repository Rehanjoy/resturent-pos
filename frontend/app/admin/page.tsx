"use client";

import Image from "next/image";
import { useHealthCheck } from "@/lib/hooks/use-health-check";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * Placeholder landing page for the /admin route group. Real POS/Dashboard
 * screens (New Order, KDS, Settle Bill, Table Grid, etc. — see
 * docs/03-wireframes) are built in later parts of the project. This page
 * only proves the scaffold wiring: React Query talking to the backend and
 * a Zustand-managed UI toggle.
 */
export default function AdminHomePage() {
  const { data, isLoading, isError, error } = useHealthCheck();
  const isNavRailCollapsed = useUiStore((state) => state.isNavRailCollapsed);
  const toggleNavRail = useUiStore((state) => state.toggleNavRail);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-6 px-6 py-16">
      <Image src="/logo.svg" alt="Saffron" width={140} height={36} priority />

      <div>
        <h1 className="font-heading text-2xl font-semibold text-text">
          Admin / POS scaffold
        </h1>
        <p className="mt-1 text-body text-text-muted">
          The Table Grid, New Order, KDS, Billing, Staff, and Dashboard
          screens are built here in later parts of the project.
        </p>
      </div>

      <section className="w-full rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-text">
          Backend connection check
        </h2>

        {isLoading && (
          <p className="mt-2 text-small text-text-muted">
            Checking connection to the API…
          </p>
        )}

        {isError && (
          <p className="mt-2 text-small text-error">
            Could not reach the API — check your connection and try again.
            {error instanceof Error ? ` (${error.message})` : null}
          </p>
        )}

        {data && (
          <p className="mt-2 text-small text-success">
            Connected — backend reports status &quot;{data.status}&quot;.
          </p>
        )}
      </section>

      <section className="w-full rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-text">
          UI state check
        </h2>
        <p className="mt-1 text-small text-text-muted">
          Nav rail collapsed: {isNavRailCollapsed ? "yes" : "no"}
        </p>
        <button
          type="button"
          onClick={toggleNavRail}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-button text-white"
        >
          Toggle nav rail state
        </button>
      </section>
    </main>
  );
}
