/**
 * QR self-ordering PWA — placeholder for Phase 2 (PRD Phase 2 feature
 * list). Guests scan a table QR code that links here; the real flow adds
 * a pending-approval gate before the order reaches the kitchen.
 */
export default async function QrOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold text-text">
        QR Ordering — Coming Soon
      </h1>
      <p className="max-w-sm text-body text-text-muted">
        Self-ordering for table <span className="font-medium">{tableId}</span>{" "}
        is built in Phase 2 of the Saffron rollout.
      </p>
    </main>
  );
}
