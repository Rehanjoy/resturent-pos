import { KdsBoard } from "@/components/kitchen/kds-board";

/**
 * Kitchen Display System (PRD §3.4). Server component shell — all
 * interaction (real-time ticket feed, Mark Ready actions) lives in the
 * client component per coding-standards.md.
 */
export default function KitchenPage() {
  return <KdsBoard />;
}
