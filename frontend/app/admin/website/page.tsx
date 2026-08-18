import { WebsiteScreen } from "@/components/website/website-screen";

/**
 * Website Builder — admin editor half (PRD §3.13). Server component shell;
 * interaction (forms, publish toggle, mutations) lives in the client
 * component, same pattern as `app/admin/inventory/page.tsx`. The public,
 * unauthenticated half of this module lives at
 * `app/(website)/[slug]/page.tsx`.
 */
export default function WebsitePage() {
  return <WebsiteScreen />;
}
