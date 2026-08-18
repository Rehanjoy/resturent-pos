import { InventoryScreen } from "@/components/inventory/inventory-screen";

/**
 * Inventory Management (PRD §3.9). Server component shell — interaction
 * (search, forms, mutations) lives in the client component, same pattern
 * as `app/admin/menu/page.tsx`.
 */
export default function InventoryPage() {
  return <InventoryScreen />;
}
