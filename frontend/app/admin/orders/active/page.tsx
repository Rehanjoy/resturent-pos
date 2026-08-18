import { OrderWorkspace } from "@/components/orders/order-workspace";

/**
 * Active Order (PRD §3.3). Reached from the Table Grid's occupied-table
 * cards (`/admin/tables` → `router.push('/admin/orders/active?tableId=...')`).
 * Server component shell — all interaction lives in `OrderWorkspace`.
 */
export default async function ActiveOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const { tableId } = await searchParams;

  if (!tableId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-text-muted">
          No table selected. Go back to the table grid and pick a table to manage its order.
        </p>
      </main>
    );
  }

  return <OrderWorkspace tableId={tableId} mode="active" />;
}
