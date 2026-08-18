import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { PhoneIcon } from "@/components/icons";
import { getPublicWebsite, PublicWebsiteNotFoundError } from "@/lib/website/public-api";
import type { PublicWebsite } from "@/lib/website/types";

interface PageParams {
  params: Promise<{ slug: string }>;
}

async function loadWebsite(slug: string): Promise<PublicWebsite | null> {
  try {
    return await getPublicWebsite(slug);
  } catch (error) {
    if (error instanceof PublicWebsiteNotFoundError) return null;
    throw error;
  }
}

function formatAddress(address: PublicWebsite["restaurant"]["address"]): string | null {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode]
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * SEO metadata (PRD §3.13 "SEO-friendly — meta tags"). Next.js dedupes an
 * identical `fetch()` call made in both `generateMetadata` and the page
 * body into a single network request, so calling `loadWebsite` again below
 * is not a second round-trip.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const website = await loadWebsite(slug);
  if (!website) return { title: "Restaurant not found" };

  const description = website.content.aboutText
    ? website.content.aboutText.slice(0, 155)
    : `${website.restaurant.name} — menu, location, and contact details.`;

  return {
    title: website.content.heroHeadline
      ? `${website.restaurant.name} — ${website.content.heroHeadline}`
      : website.restaurant.name,
    description,
    openGraph: {
      title: website.restaurant.name,
      description,
      images: website.content.heroImageUrl ? [{ url: website.content.heroImageUrl }] : undefined,
    },
  };
}

export default async function PublicRestaurantPage({ params }: PageParams) {
  const { slug } = await params;
  const website = await loadWebsite(slug);
  if (!website) notFound();

  const { restaurant, content, menu } = website;
  const addressLine = formatAddress(restaurant.address);

  // Schema.org Restaurant structured data (PRD §3.13 "structured data —
  // Schema.org Restaurant markup"). Only public-safe fields, mirroring
  // exactly what the page itself renders — no data beyond what a visitor
  // can already see.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    ...(content.heroImageUrl ? { image: content.heroImageUrl } : {}),
    ...(restaurant.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: [restaurant.address.line1, restaurant.address.line2]
              .filter(Boolean)
              .join(", "),
            addressLocality: restaurant.address.city,
            addressRegion: restaurant.address.state,
            postalCode: restaurant.address.postalCode,
            addressCountry: restaurant.address.country,
          },
        }
      : {}),
    ...(content.contactPhone ? { telephone: content.contactPhone } : {}),
  };

  return (
    <main className="flex flex-1 flex-col bg-background text-text">
      {/* Static, server-generated JSON we built above, not user-supplied HTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="relative flex min-h-[360px] flex-col items-center justify-center gap-4 overflow-hidden bg-text px-6 py-20 text-center text-white">
        {content.heroImageUrl && (
          // Plain <img>, not next/image — hero/gallery/dish images are
          // arbitrary admin-entered URLs (no S3/CDN pipeline yet, see
          // `backend/src/models/website-content.model.ts`), so there's no
          // fixed remote-pattern allowlist to configure. Matches the same
          // convention already used for dish images in
          // `components/menu/dish-table.tsx`.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
        )}
        <div className="relative flex flex-col items-center gap-3">
          <h1 className="font-heading text-h1 font-semibold">{restaurant.name}</h1>
          {content.heroHeadline && <p className="max-w-xl text-body text-white/90">{content.heroHeadline}</p>}
        </div>
      </section>

      {content.aboutText && (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-14 text-center">
          <h2 className="font-heading text-h3 font-semibold text-text">About Us</h2>
          <p className="whitespace-pre-line text-body text-text-muted">{content.aboutText}</p>
        </section>
      )}

      {menu.length > 0 && (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-14">
          <h2 className="text-center font-heading text-h3 font-semibold text-text">Menu</h2>
          {menu.map((category) => (
            <div key={category.id} className="flex flex-col gap-4">
              <h3 className="font-heading text-h4 font-semibold text-primary">{category.name}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text">{item.name}</p>
                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-small text-text-muted">{item.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-text">
                      {formatMoney(item.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {content.galleryImageUrls.length > 0 && (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-14">
          <h2 className="text-center font-heading text-h3 font-semibold text-text">Gallery</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {content.galleryImageUrls.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-2xl bg-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- see hero image comment above */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {(content.contactPhone || content.contactEmail || addressLine || content.mapEmbedUrl) && (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-14">
          <h2 className="text-center font-heading text-h3 font-semibold text-text">Visit Us</h2>
          <div className="flex flex-col items-center gap-2 text-body text-text-muted">
            {addressLine && <p>{addressLine}</p>}
            {content.contactPhone && (
              <p className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4" /> {content.contactPhone}
              </p>
            )}
            {content.contactEmail && <p>{content.contactEmail}</p>}
          </div>
          {content.mapEmbedUrl && (
            <iframe
              src={content.mapEmbedUrl}
              title={`Map to ${restaurant.name}`}
              className="h-72 w-full rounded-2xl border border-border"
              loading="lazy"
            />
          )}
        </section>
      )}

      <footer className="border-t border-border px-6 py-8 text-center text-small text-text-muted">
        {restaurant.name}
        {restaurant.gstNumber && ` · GSTIN ${restaurant.gstNumber}`}
      </footer>
    </main>
  );
}
