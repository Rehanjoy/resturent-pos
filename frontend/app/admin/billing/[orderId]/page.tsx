import { BillingWorkspace } from "@/components/billing/billing-workspace";

/**
 * Settle Bill (PRD §3.10). Reached from the Active Order screen's
 * "Settle Bill" action once an order reaches `served`. Server component
 * shell — all interaction lives in `BillingWorkspace`.
 */
export default async function BillingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return <BillingWorkspace orderId={orderId} />;
}
