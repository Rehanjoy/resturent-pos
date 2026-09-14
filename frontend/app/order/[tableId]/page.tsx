import { CustomerDining } from "@/components/dining/customer-dining";

export default async function QrOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  return <CustomerDining qrToken={tableId} />;
}
