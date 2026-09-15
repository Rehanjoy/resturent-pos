import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { CheckCircleIcon, ClockIcon, PhoneIcon } from "@/components/icons";
import { getPublicWebsite, PublicWebsiteNotFoundError } from "@/lib/website/public-api";
import type { PublicWebsite } from "@/lib/website/types";

interface PageParams { params: Promise<{ slug: string }>; }

async function loadWebsite(slug: string): Promise<PublicWebsite | null> {
  try { return await getPublicWebsite(slug); }
  catch (error) { if (error instanceof PublicWebsiteNotFoundError) return null; throw error; }
}

function formatAddress(address: PublicWebsite["restaurant"]["address"]): string | null {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const website = await loadWebsite(slug);
  if (!website) return { title: "Restaurant not found" };
  const description = website.content.aboutText?.slice(0, 155) ?? `${website.restaurant.name} \u2014 menu, location, and contact details.`;
  return {
    title: website.content.heroHeadline ? `${website.restaurant.name} \u2014 ${website.content.heroHeadline}` : website.restaurant.name,
    description,
    openGraph: { title: website.restaurant.name, description, images: website.content.heroImageUrl ? [{ url: website.content.heroImageUrl }] : undefined },
  };
}

export default async function PublicRestaurantPage({ params }: PageParams) {
  const { slug } = await params;
  const website = await loadWebsite(slug);
  if (!website) notFound();
  const { restaurant, content, menu } = website;
  const addressLine = formatAddress(restaurant.address);
  const itemCount = menu.reduce((sum, category) => sum + category.items.length, 0);
  const structuredData = {
    "@context": "https://schema.org", "@type": "Restaurant", name: restaurant.name,
    ...(content.heroImageUrl ? { image: content.heroImageUrl } : {}),
    ...(restaurant.address ? { address: { "@type": "PostalAddress", streetAddress: [restaurant.address.line1, restaurant.address.line2].filter(Boolean).join(", "), addressLocality: restaurant.address.city, addressRegion: restaurant.address.state, postalCode: restaurant.address.postalCode, addressCountry: restaurant.address.country } } : {}),
    ...(content.contactPhone ? { telephone: content.contactPhone } : {}),
  };

  return (
    <main className="ambient-shell min-h-screen overflow-hidden bg-transparent text-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
        <nav aria-label="Restaurant navigation" className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-6">
          <a href="#top" className="max-w-[52vw] truncate font-heading text-base font-semibold tracking-tight sm:text-lg">{restaurant.name}</a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#menu" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-text-muted transition hover:bg-white/60 hover:text-primary">Menu</a>
            {content.contactPhone ? <a href={`tel:${content.contactPhone}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(229,62,21,.24)]"><PhoneIcon className="h-4 w-4" /><span className="hidden sm:inline">Call us</span></a> : null}
          </div>
        </nav>
      </header>

      <section id="top" className="relative flex min-h-[680px] items-end overflow-hidden bg-[#241a16] px-5 pb-16 pt-32 text-white sm:px-8 sm:pb-20 lg:min-h-[760px] lg:px-12">
        {content.heroImageUrl ? <Image src={content.heroImageUrl} alt="" fill priority unoptimized sizes="100vw" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,130,77,.48),transparent_26rem),linear-gradient(135deg,#241a16,#6e2d1d)]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-xl">Welcome to {restaurant.name}</span>
            <h1 className="mt-6 font-heading text-[clamp(2.75rem,8vw,6.5rem)] font-semibold leading-[.96] tracking-[-.055em]">{content.heroHeadline || "Food worth slowing down for."}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/72 sm:text-lg">Explore today&apos;s menu, discover house favourites and plan your visit.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#menu" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 font-semibold text-white shadow-xl transition hover:-translate-y-0.5">Explore the menu</a>{addressLine ? <a href="#visit" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/10 px-7 font-semibold text-white backdrop-blur-xl transition hover:bg-white/18">Plan your visit</a> : null}</div>
          </div>
          <div className="glass-panel grid min-w-64 grid-cols-2 gap-2 rounded-2xl p-2 text-text"><div className="rounded-xl bg-white/75 p-4"><p className="text-2xl font-semibold tabular-nums">{itemCount}</p><p className="mt-1 text-xs text-text-muted">Dishes on menu</p></div><div className="rounded-xl bg-white/75 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircleIcon className="h-4 w-4" />Fresh</p><p className="mt-2 text-xs text-text-muted">Prepared to order</p></div></div>
        </div>
      </section>

      {content.aboutText ? <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-10 lg:py-28"><div><p className="text-sm font-semibold text-primary">Our kitchen</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Made with care, served with warmth.</h2></div><div className="glass-panel rounded-[2rem] p-6 sm:p-9"><p className="whitespace-pre-line text-base leading-8 text-text-muted sm:text-lg">{content.aboutText}</p></div></section> : null}

      {menu.length > 0 ? <section id="menu" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="max-w-2xl"><p className="text-sm font-semibold text-primary">The menu</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Choose what feels right today.</h2><p className="mt-4 text-base leading-7 text-text-muted">Prices are shown clearly. Ask our team about allergens or custom preparation.</p></div><div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-2">{menu.map((category) => <a key={category.id} href={`#category-${category.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/85 bg-white/65 px-5 text-sm font-semibold text-text shadow-sm backdrop-blur-xl hover:text-primary">{category.name}</a>)}</div><div className="mt-12 space-y-16">{menu.map((category) => <section key={category.id} id={`category-${category.id}`} className="scroll-mt-28"><div className="mb-5 flex items-end justify-between gap-4"><h3 className="font-heading text-2xl font-semibold">{category.name}</h3><span className="text-sm text-text-muted">{category.items.length} {category.items.length === 1 ? "dish" : "dishes"}</span></div><div className="grid gap-4 md:grid-cols-2">{category.items.map((item) => <article key={item.id} className="glass-panel interactive-lift group flex min-h-36 overflow-hidden rounded-[1.5rem] p-2"><div className="relative w-28 shrink-0 overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-primary/12 to-secondary/12 sm:w-36">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 768px) 7rem, 9rem" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-primary/35"><ClockIcon className="h-8 w-8" /></div>}</div><div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-semibold leading-5">{item.name}</h4><strong className="shrink-0 text-sm tabular-nums">{formatMoney(item.price)}</strong></div>{item.description ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-text-muted sm:text-sm">{item.description}</p> : null}<div className="mt-auto flex items-center gap-2 pt-3 text-[11px] font-medium text-text-muted"><span className={`h-2 w-2 rounded-full ${item.type === "veg" ? "bg-success" : "bg-error"}`} /><span>{item.type === "veg" ? "Vegetarian" : item.type === "egg" ? "Contains egg" : "Non-vegetarian"}</span>{item.spiceLevel && item.spiceLevel !== "none" ? <span>Â· {item.spiceLevel}</span> : null}</div></div></article>)}</div></section>)}</div></section> : null}

      {content.galleryImageUrls.length > 0 ? <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="mb-8 max-w-xl"><p className="text-sm font-semibold text-primary">From the restaurant</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em] sm:text-5xl">A glimpse of the table.</h2></div><div className="grid auto-rows-[170px] grid-cols-2 gap-3 sm:auto-rows-[230px] lg:grid-cols-3">{content.galleryImageUrls.map((url, index) => <div key={url} className={`relative overflow-hidden rounded-[1.5rem] bg-border ${index === 0 ? "col-span-2 row-span-2" : ""}`}><Image src={url} alt="Restaurant gallery" fill unoptimized sizes="(max-width: 640px) 50vw, 33vw" className="h-full w-full object-cover transition duration-500 hover:scale-105" /></div>)}</div></section> : null}

      {(content.contactPhone || content.contactEmail || addressLine || content.mapEmbedUrl) ? <section id="visit" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="glass-elevated overflow-hidden rounded-[2rem] lg:grid lg:grid-cols-2"><div className="p-6 sm:p-10"><p className="text-sm font-semibold text-primary">Visit us</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.035em]">Your table is waiting.</h2><div className="mt-7 space-y-3 text-sm leading-6 text-text-muted">{addressLine ? <p>{addressLine}</p> : null}{content.contactPhone ? <a href={`tel:${content.contactPhone}`} className="flex min-h-11 items-center gap-2 font-semibold text-text hover:text-primary"><PhoneIcon className="h-4 w-4" />{content.contactPhone}</a> : null}{content.contactEmail ? <a href={`mailto:${content.contactEmail}`} className="block min-h-11 py-2 font-semibold text-text hover:text-primary">{content.contactEmail}</a> : null}</div></div>{content.mapEmbedUrl ? <iframe src={content.mapEmbedUrl} title={`Map to ${restaurant.name}`} className="h-80 w-full border-0 lg:h-full lg:min-h-96" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="min-h-64 bg-[radial-gradient(circle_at_60%_40%,rgba(229,62,21,.25),transparent_16rem),linear-gradient(135deg,#f9dfd5,#f1ebe8)]" />}</div></section> : null}

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-border/70 px-5 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span className="font-semibold text-text">{restaurant.name}</span><span>{restaurant.gstNumber ? `GSTIN ${restaurant.gstNumber}` : "Fresh food, thoughtful service"}</span></footer>
    </main>
  );
}