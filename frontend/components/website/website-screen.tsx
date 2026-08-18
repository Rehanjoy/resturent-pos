"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { websiteApi, type UpdateWebsiteContentInput } from "@/lib/website/api";
import { settingsApi } from "@/lib/settings/api";
import { PageHeader } from "@/components/ui/page-header";
import { HeroForm, type HeroFormValues } from "./hero-form";
import { AboutForm } from "./about-form";
import { GallerySection } from "./gallery-section";
import { ContactForm, type ContactFormValues } from "./contact-form";
import { PublishPanel } from "./publish-panel";

// PRD §2 Website column: Owner "Full", Manager "View", every other role no
// access at all (no nav entry — see `sidebar.tsx` — and this screen also
// self-gates in case the URL is hit directly, same pattern every other
// module screen follows). Manager NOT getting write access here is a
// deliberate deviation from this app's usual "Manager can edit operational
// stuff" pattern — see `backend/src/routes/website.routes.ts`.
const VIEW_ROLES = new Set(["owner", "manager"]);
const MANAGE_ROLES = new Set(["owner"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function WebsiteScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canView = !!user && VIEW_ROLES.has(user.role);
  const canManage = !!user && MANAGE_ROLES.has(user.role);

  const [notice, setNotice] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  const [origin, setOrigin] = useState("");

  // `window` isn't available during server render — the public link is a
  // client-only nicety, not something the page's correctness depends on.
  // Deliberately setState-in-effect: this synchronizes with a browser-only
  // API (`window.location`) that has no server-rendered equivalent, which
  // is exactly the case React's own docs carve out as legitimate — reading
  // it during render instead would either crash on the server or produce a
  // hydration mismatch, both worse than the one-tick-later update here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const contentQuery = useQuery({
    queryKey: ["website-content"],
    queryFn: () => websiteApi.getContent().then((result) => result.content),
    enabled: canView,
  });

  // Slug lives on the Settings resource, not on WebsiteContent (see
  // `backend/src/models/website-content.model.ts` — restaurant identity
  // fields aren't duplicated there). Settings GET is Owner/Manager too, so
  // the same role gate that unlocks this screen also unlocks this read.
  const slugQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get().then((result) => result.settings.slug),
    enabled: canView,
  });

  const publicUrl = useMemo(
    () => (origin && slugQuery.data ? `${origin}/${slugQuery.data}` : ""),
    [origin, slugQuery.data],
  );

  function onSuccessFor(section: string) {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["website-content"] });
      setError((current) => ({ ...current, [section]: null }));
      setNotice((current) => ({ ...current, [section]: "Saved." }));
      setTimeout(() => setNotice((current) => ({ ...current, [section]: null })), 2500);
    };
  }

  function onErrorFor(section: string, fallback: string) {
    return (err: unknown) =>
      setError((current) => ({ ...current, [section]: errorMessageOf(err, fallback) }));
  }

  const heroMutation = useMutation({
    mutationFn: (input: HeroFormValues) =>
      websiteApi.updateContent({
        heroImageUrl: input.heroImageUrl,
        heroHeadline: input.heroHeadline,
      } satisfies UpdateWebsiteContentInput),
    onSuccess: onSuccessFor("hero"),
    onError: onErrorFor("hero", "Could not save the hero section."),
  });

  const aboutMutation = useMutation({
    mutationFn: (aboutText: string) => websiteApi.updateContent({ aboutText }),
    onSuccess: onSuccessFor("about"),
    onError: onErrorFor("about", "Could not save the about section."),
  });

  const contactMutation = useMutation({
    mutationFn: (input: ContactFormValues) =>
      websiteApi.updateContent({
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        mapEmbedUrl: input.mapEmbedUrl,
      } satisfies UpdateWebsiteContentInput),
    onSuccess: onSuccessFor("contact"),
    onError: onErrorFor("contact", "Could not save contact details."),
  });

  const addGalleryMutation = useMutation({
    mutationFn: (imageUrl: string) => websiteApi.addGalleryImage(imageUrl),
    onSuccess: onSuccessFor("gallery"),
    onError: onErrorFor("gallery", "Could not add this image."),
  });

  const removeGalleryMutation = useMutation({
    mutationFn: (imageUrl: string) => {
      const current = contentQuery.data?.galleryImageUrls ?? [];
      return websiteApi.updateContent({
        galleryImageUrls: current.filter((url) => url !== imageUrl),
      });
    },
    onSuccess: onSuccessFor("gallery"),
    onError: onErrorFor("gallery", "Could not remove this image."),
  });

  const publishMutation = useMutation({
    mutationFn: (isPublished: boolean) => websiteApi.updateContent({ isPublished }),
    onSuccess: onSuccessFor("publish"),
    onError: onErrorFor("publish", "Could not update the publish status."),
  });

  if (!user) return null;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You don&apos;t have access to Website.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Website"
        subtitle="Your public restaurant site — hero, about, gallery, contact, and live menu."
      />

      {contentQuery.isLoading && <p className="text-small text-text-muted">Loading website content…</p>}

      {contentQuery.isError && (
        <p className="text-small text-error">
          Could not load website content — check your connection and try again.
        </p>
      )}

      {contentQuery.data && (
        <>
          <PublishPanel
            isPublished={contentQuery.data.isPublished}
            publicUrl={publicUrl || "…"}
            canEdit={canManage}
            onToggle={(next) => publishMutation.mutate(next)}
            isSubmitting={publishMutation.isPending}
            errorMessage={error.publish ?? null}
          />

          <HeroForm
            content={contentQuery.data}
            canEdit={canManage}
            onSubmit={(values) => heroMutation.mutate(values)}
            isSubmitting={heroMutation.isPending}
            errorMessage={error.hero ?? null}
            successMessage={notice.hero ?? null}
          />

          <AboutForm
            content={contentQuery.data}
            canEdit={canManage}
            onSubmit={(aboutText) => aboutMutation.mutate(aboutText)}
            isSubmitting={aboutMutation.isPending}
            errorMessage={error.about ?? null}
            successMessage={notice.about ?? null}
          />

          <GallerySection
            galleryImageUrls={contentQuery.data.galleryImageUrls}
            canEdit={canManage}
            onAdd={(imageUrl) => addGalleryMutation.mutate(imageUrl)}
            onRemove={(imageUrl) => removeGalleryMutation.mutate(imageUrl)}
            isAdding={addGalleryMutation.isPending}
            isRemoving={removeGalleryMutation.isPending}
            errorMessage={error.gallery ?? null}
          />

          <ContactForm
            content={contentQuery.data}
            canEdit={canManage}
            onSubmit={(values) => contactMutation.mutate(values)}
            isSubmitting={contactMutation.isPending}
            errorMessage={error.contact ?? null}
            successMessage={notice.contact ?? null}
          />
        </>
      )}
    </main>
  );
}
