/**
 * Shared chrome for every /admin route (POS + Dashboard). The left
 * icon-only nav rail, top bar, etc. from docs/03-wireframes get built out
 * here in later parts — this just reserves the layout slot and applies
 * the app canvas background.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
