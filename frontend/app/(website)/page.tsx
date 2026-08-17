import Image from "next/image";

/**
 * Public restaurant website — placeholder for the Website Builder module
 * (PRD Phase 2, §3.13). This route group will hold the SSG/ISR public
 * site once that module is built.
 */
export default function WebsiteHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-center">
      <Image src="/logo.svg" alt="Saffron" width={160} height={40} priority />
      <h1 className="font-heading text-3xl font-semibold text-text">
        Saffron
      </h1>
      <p className="max-w-md text-body text-text-muted">
        The public restaurant website (menu, hours, location) is built here
        in Phase 2 — Website Builder module.
      </p>
    </main>
  );
}
