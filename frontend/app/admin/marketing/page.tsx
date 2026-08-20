import { MarketingScreen } from "@/components/marketing/marketing-screen";

/**
 * Marketing module — WhatsApp marketing via Meta's official WhatsApp
 * Business Cloud API (not a third-party CRM). Part 1 of 3: Setup
 * (connection config) + Contacts tabs. Part 2 will add a Campaigns tab,
 * Part 3 an Inbox tab, both inside this same screen (see
 * `marketing-screen.tsx`'s tab list). Server component shell; interaction
 * lives in the client component, same pattern as `app/admin/website/page.tsx`.
 */
export default function MarketingPage() {
  return <MarketingScreen />;
}
