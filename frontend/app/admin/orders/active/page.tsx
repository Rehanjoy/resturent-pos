import { OrderWorkspace } from "@/components/orders/order-workspace";
import { OrdersOverview } from "@/components/orders/orders-overview";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Active Order (PRD §3.3). Reached either from the Table Grid's
 * occupied-table cards (`?tableId=...` → a single table's order workspace)
 * or directly from the sidebar's "Orders" nav item with no `tableId` — in
 * that case this shows every order created today, grouped by table
 * (`OrdersOverview`), instead of the old dead-end "no table selected"
 * message.
 */
export default async function ActiveOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const { tableId } = await searchParams;

  if (!tableId) {
    return (
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PageHeader title="Orders" subtitle="Every order today, by table" />
        <OrdersOverview />
      </main>
    );
  }

  return <OrderWorkspace tableId={tableId} mode="active" />;
}
