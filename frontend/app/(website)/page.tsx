import Image from "next/image";
import Link from "next/link";
import { BoxIcon, CheckCircleIcon, ClockIcon, KitchenIcon, OrdersIcon, TableIcon } from "@/components/icons";

const sampleMenu = [
  { name: "Smoked paneer tikka", detail: "Charred peppers, mint chutney", price: "\u20B9320", tone: "from-orange-300 to-red-500" },
  { name: "Awadhi biryani", detail: "Saffron rice, slow-cooked masala", price: "\u20B9390", tone: "from-amber-200 to-orange-500" },
  { name: "Rose pistachio kulfi", detail: "House-made, roasted pistachio", price: "\u20B9180", tone: "from-rose-200 to-amber-300" },
];

export default function WebsiteHomePage() {
  return (
    <main className="ambient-shell min-h-screen overflow-hidden bg-transparent text-text">
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
        <nav aria-label="Main navigation" className="glass-panel mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 overflow-hidden rounded-2xl px-3 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-xl px-1" aria-label="Saffron home">
            <Image src="/logo-mark.svg" alt="" width={34} height={34} priority />
            <span className="font-heading text-lg font-semibold tracking-tight">Saffron</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-text-muted md:flex">
            <a href="#platform" className="transition-colors hover:text-primary">Platform</a>
            <a href="#menu" className="transition-colors hover:text-primary">Guest experience</a>
            <a href="#operations" className="transition-colors hover:text-primary">Operations</a>
          </div>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(229,62,21,.25)] transition hover:-translate-y-0.5 hover:bg-accent"><span className="hidden sm:inline">Open workspace</span><span className="sm:hidden">Login</span></Link>
        </nav>
      </header>

      <section className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
        <div className="min-w-0 max-w-2xl">
          <p className="inline-flex rounded-full border border-white/80 bg-white/58 px-4 py-2 text-sm font-semibold text-primary shadow-sm backdrop-blur-xl">Built for the rhythm of real restaurants</p>
          <h1 className="mt-7 font-heading text-[clamp(2.7rem,7vw,5.7rem)] font-semibold leading-[.98] tracking-[-.055em]">A calmer service, from first scan to final bill.</h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">Saffron connects tables, kitchen, billing, staff and ingredient-level inventory in one live workspace, so every guest sees progress and every team member knows what needs attention.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-white shadow-[0_14px_34px_rgba(255,75,36,.28)] transition hover:-translate-y-0.5">Enter restaurant workspace</Link>
            <a href="#menu" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/85 bg-white/62 px-7 text-base font-semibold text-text shadow-sm backdrop-blur-xl transition hover:bg-white">Explore the guest flow</a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-muted">
            {["Live order updates", "Chair-level QR seating", "Recipe-accurate stock"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-success" />{item}</span>)}
          </div>
        </div>

        <div className="relative mx-auto min-w-0 w-full max-w-xl overflow-hidden rounded-[2rem]" aria-label="Live restaurant operations preview">
          <div className="absolute -inset-10 -z-10 rounded-full bg-primary/15 blur-3xl" />
          <div className="glass-elevated overflow-hidden rounded-[2rem] p-3 sm:p-4">
            <div className="rounded-[1.5rem] bg-[#221b18] p-4 text-white sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-sm text-white/60">Dinner service</p><h2 className="mt-1 font-heading text-xl font-semibold">Live floor</h2></div><span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">Connected</span></div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/7 p-4"><div className="flex items-center justify-between"><span className="text-sm text-white/65">Orders in progress</span><OrdersIcon className="h-5 w-5 text-orange-300" /></div><p className="mt-3 text-4xl font-semibold tabular-nums">18</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-orange-400 to-red-400" /></div></div>
                <div className="rounded-2xl border border-white/10 bg-white/7 p-4"><KitchenIcon className="h-5 w-5 text-amber-300" /><p className="mt-5 text-2xl font-semibold">06</p><p className="mt-1 text-xs text-white/55">Kitchen tickets</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/7 p-4"><ClockIcon className="h-5 w-5 text-cyan-300" /><p className="mt-5 text-2xl font-semibold">12m</p><p className="mt-1 text-xs text-white/55">Average prep</p></div>
              </div>
            </div>
          </div>
          <div className="glass-panel absolute -bottom-7 -left-2 hidden rounded-2xl p-4 sm:block"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><TableIcon className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Table 06 ready</p><p className="text-xs text-text-muted">Guest notified now</p></div></div></div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="min-w-0 max-w-2xl"><p className="text-sm font-semibold text-primary">One connected service</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Every handoff stays visible.</h2><p className="mt-4 text-base leading-7 text-text-muted">Purpose-built views keep the floor fast without hiding the details owners need.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [TableIcon, "Smart seating", "Book a whole table or selected chairs, hold seats briefly, and move directly into ordering."],
            [KitchenIcon, "Kitchen confidence", "Item-level timing, ready alerts and live status make every ticket easier to control."],
            [BoxIcon, "Precise food cost", "Recipes connect each serving to ingredient stock, cost, usage and low-stock forecasting."],
          ].map(([Icon, title, copy]) => { const FeatureIcon = Icon as typeof TableIcon; return <article key={title as string} className="glass-panel interactive-lift rounded-[1.75rem] p-6 sm:p-7"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FeatureIcon className="h-6 w-6" /></span><h3 className="mt-6 font-heading text-xl font-semibold">{title as string}</h3><p className="mt-3 text-sm leading-6 text-text-muted">{copy as string}</p></article>; })}
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end"><div><p className="text-sm font-semibold text-primary">Guest menu</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Designed to feel as considered as the food.</h2><p className="mt-5 text-base leading-7 text-text-muted">Clear choices, transparent totals and live preparation updates build trust from the first tap.</p></div><div className="grid gap-4 sm:grid-cols-3">{sampleMenu.map((item) => <article key={item.name} className="glass-panel overflow-hidden rounded-[1.75rem] p-2"><div className={`relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${item.tone}`}><div className="absolute inset-5 rounded-full border border-white/35 bg-white/12 shadow-inner backdrop-blur-sm" /></div><div className="p-3.5"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-5">{item.name}</h3><strong className="text-sm tabular-nums">{item.price}</strong></div><p className="mt-2 text-xs leading-5 text-text-muted">{item.detail}</p></div></article>)}</div></div>
      </section>

      <section id="operations" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10"><div className="relative overflow-hidden rounded-[2.25rem] bg-[#211916] px-6 py-14 text-white shadow-2xl sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-16"><div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/25 blur-3xl" /><div className="relative max-w-2xl"><h2 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Give every shift one source of truth.</h2><p className="mt-5 text-base leading-7 text-white/65">Open the secure workspace for live orders, kitchen, tables, staff, inventory and earnings.</p></div><Link href="/login" className="relative mt-8 inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-white px-7 font-semibold text-text transition hover:-translate-y-0.5 lg:mt-0">Sign in to Saffron</Link></div></section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span className="flex items-center gap-2"><Image src="/logo-mark.svg" alt="" width={24} height={24} />Saffron Restaurant OS</span><span>Clear service. Precise operations.</span></footer>
    </main>
  );
}