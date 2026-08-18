import { TablesScreen } from "@/components/tables/tables-screen";

/**
 * Table & Area Management (PRD §3.5). Server component shell — all
 * interaction (area tabs, live status grid, socket subscription) lives in
 * the client component per coding-standards.md ("use client" only where
 * interaction demands it).
 */
export default function TablesPage() {
  return <TablesScreen />;
}
