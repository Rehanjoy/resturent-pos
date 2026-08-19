"use client";

import { use } from "react";
import { InvoiceDetailScreen } from "@/components/billing/invoice-detail-screen";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <InvoiceDetailScreen invoiceId={id} />;
}
