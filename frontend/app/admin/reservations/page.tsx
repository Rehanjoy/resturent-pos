import { ReservationsScreen } from "@/components/reservations/reservations-screen";

/**
 * Reservation Management (PRD §3.7). Server component shell — interaction
 * (date navigation, filters, forms, mutations) lives in the client
 * component, same pattern as `app/admin/inventory/page.tsx`.
 */
export default function ReservationsPage() {
  return <ReservationsScreen />;
}
